package payments

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

// FirmwareCompiler gestiona la compilacion de firmware personalizado para terminales.
// Usa un contenedor Docker con Arduino CLI para compilar el .bin.
type FirmwareCompiler struct {
	FirmwareDir     string // ruta al directorio firmware/ del repositorio
	BuildDir        string // directorio temporal para builds
	DockerImage     string // nombre de la imagen Docker del compilador
	CompilerTimeout time.Duration
}

func NewFirmwareCompiler(firmwareDir, buildDir, dockerImage string) *FirmwareCompiler {
	if dockerImage == "" {
		dockerImage = "fmc-arduino-compiler:latest"
	}
	return &FirmwareCompiler{
		FirmwareDir:     firmwareDir,
		BuildDir:        buildDir,
		DockerImage:     dockerImage,
		CompilerTimeout: 5 * time.Minute,
	}
}

// CompileResult contiene el resultado de una compilacion
type CompileResult struct {
	BinaryPath string
	Size       int64
	BuildID    string
}

// CompileFirmware compila el firmware para un terminal especifico.
// 1. Genera el config.h con los datos del terminal
// 2. Ejecuta el contenedor Docker con Arduino CLI
// 3. Retorna la ruta al .bin compilado
func (fc *FirmwareCompiler) CompileFirmware(ctx context.Context, terminal *NFCTerminal, token, serverURL string) (*CompileResult, error) {
	buildID := uuid.New().String()
	buildDir := filepath.Join(fc.BuildDir, buildID)

	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return nil, fmt.Errorf("creating build dir: %w", err)
	}

	// 1. Generar config.h
	configHPath := filepath.Join(buildDir, "config.h")
	configContent := fc.generateConfigH(terminal, token, serverURL)
	if err := os.WriteFile(configHPath, []byte(configContent), 0644); err != nil {
		return nil, fmt.Errorf("writing config.h: %w", err)
	}

	// 2. Ruta de salida para el .bin
	outputBin := filepath.Join(buildDir, "firmware.bin")

	// 3. Ejecutar el contenedor Docker
	// Montar:
	//   - firmware/ del repositorio -> /firmware (read-only)
	//   - config.h generado -> /build-config/config.h (read-only)
	//   - directorio de build -> /build-output (read-write)
	dockerArgs := []string{
		"run",
		"--rm",
		"-v", fmt.Sprintf("%s:/firmware:ro", fc.FirmwareDir),
		"-v", fmt.Sprintf("%s:/build-config/config.h:ro", configHPath),
		"-v", fmt.Sprintf("%s:/build-output", buildDir),
		fc.DockerImage,
		terminal.TerminalType,           // arg 1: tipo de terminal
		"/build-config/config.h",        // arg 2: config.h
		"/build-output/firmware.bin",    // arg 3: output
	}

	compileCtx, cancel := context.WithTimeout(ctx, fc.CompilerTimeout)
	defer cancel()

	cmd := exec.CommandContext(compileCtx, "docker", dockerArgs...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Guardar el log de compilacion para debugging
		logPath := filepath.Join(buildDir, "compile.log")
		os.WriteFile(logPath, output, 0644)
		return nil, fmt.Errorf("compilation failed: %w\nLog:\n%s", err, string(output))
	}

	// 4. Verificar que el .bin existe
	info, err := os.Stat(outputBin)
	if err != nil {
		return nil, fmt.Errorf("compiled binary not found: %w", err)
	}

	return &CompileResult{
		BinaryPath: outputBin,
		Size:       info.Size(),
		BuildID:    buildID,
	}, nil
}

// generateConfigH genera el contenido del config.h para un terminal especifico
func (fc *FirmwareCompiler) generateConfigH(terminal *NFCTerminal, token, serverURL string) string {
	lockPin := "0000"
	// Solo los terminales con teclado tienen LOCK_PIN
	hasKeypad := terminal.TerminalType == "keypad" || terminal.TerminalType == "touch" || terminal.TerminalType == "community"

	lockPinSection := ""
	if hasKeypad {
		lockPinSection = fmt.Sprintf(`
// PIN de bloqueo local (4 digitos)
// Bloqueo momentaneo del teclado — no va al servidor.
#define LOCK_PIN           "%s"
`, lockPin)
	}

	// BLE config solo para ble-reader
	bleSection := ""
	if terminal.TerminalType == "ble-reader" {
		bleSection = fmt.Sprintf(`
// Nombre del servicio BLE y caracteristicas
#define BLE_DEVICE_NAME    "%s"
#define BLE_SERVICE_UUID        "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_CHAR_CARD_UUID      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_CHAR_COMMAND_UUID   "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_CHAR_STATUS_UUID    "6e400004-b5a3-f393-e0a9-e50e24dcca9e"
`, terminal.TerminalID)
	}

	return fmt.Sprintf(`// config.h — Generado por el servidor para el terminal %s
// NO EDITAR MANUALMENTE. Este archivo se genera automaticamente.
// Vinculado al hardware ESP32 con chip ID: %s
// Si se flashea en otro ESP32, el firmware no arrancara.
// Build ID: %s

#ifndef CONFIG_H
#define CONFIG_H

// Vinculacion al hardware fisico (chip ID unico del ESP32 en efuse)
#define EXPECTED_CHIP_ID  "%s"

// Identidad del terminal (generada por el servidor)
#define TERMINAL_ID        "%s"
#define REGISTRATION_TOKEN "%s"

// URL del servidor (sin barra final)
#define SERVER_URL         "%s"
%s%s
#endif // CONFIG_H
`,
		terminal.TerminalID,
		terminal.ChipID,
		uuid.New().String(),
		terminal.ChipID,
		terminal.TerminalID,
		token,
		serverURL,
		lockPinSection,
		bleSection,
	)
}

// CleanupBuild elimina el directorio temporal de build
func (fc *FirmwareCompiler) CleanupBuild(buildID string) {
	buildDir := filepath.Join(fc.BuildDir, buildID)
	os.RemoveAll(buildDir)
}
