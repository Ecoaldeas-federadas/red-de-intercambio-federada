package cards

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ClassicDriver es un wrapper del protocolo MIFARE Classic existente.
// El código real vive en internal/payments/nfc_terminal.go.
// Este driver permite que Classic sea listado en el registry modular.
type ClassicDriver struct {
	manifest CardManifest
}

func init() {
	Register(&ClassicDriver{
		manifest: CardManifest{
			Type:         "classic",
			DisplayName:  "MIFARE Classic 1K",
			Description:  "Tarjeta legacy con 15 sectores, claves A/B por sector y Crypto1 (roto).",
			Manufacturer: "NXP Semiconductors",
			Capacity:     "full",
			Memory: MemSpec{
				TotalBytes: 1024, UserBytes: 752, PageSize: 16,
				TotalPages: 64, UserPages: 47,
				Sectors: 16, UsableSectors: 15,
			},
			Security: SecuritySpec{
				Level: "crypto1", Algorithm: "Crypto1",
				KeyLengthBits: 48, KeyCount: 30,
				MutualAuth: true, SecureMessaging: false,
				CryptoPerSlot: true, OriginalitySignature: false,
				Notes: "Crypto1 roto desde 2008.",
			},
			Compatibility: CompatibilitySpec{
				Android: "partial", IOS: "none", ESP32PN532: "full",
				PhoneReader: false,
				Notes: "Samsung si, Google Pixel no, iOS no. Requiere lector ESP32.",
			},
			Protocol: ProtocolSpec{
				Slots: 15, ActiveSlots: 15, BackupSlots: 0,
				CertificateSize: 16, Redundancy: 3,
				AuthMethod: "Crypto1_AB_keys", Rotation: "random_per_transaction",
				PreAuthTTLSeconds: 30,
				Notes: "Triple redundancia. 30 claves unicas.",
			},
			Availability: AvailabilitySpec{
				Venezuela: true, PriceUSD: 0.08,
				Notes: "Disponible en Venezuela. Mas barata pero insegura.",
			},
			Endpoints: EndpointsSpec{
				Provision: "/api/nfc/cards/provision-classic",
				PreAuth:   "/api/nfc/terminal/classic/pre-auth",
				Confirm:   "/api/nfc/terminal/classic/confirm",
			},
			Docs: []string{"docs/tarjeta-classic-certificados.md"},
		},
	})
}

func (d *ClassicDriver) GetType() string         { return "classic" }
func (d *ClassicDriver) GetManifest() CardManifest { return d.manifest }
func (d *ClassicDriver) RequiresDocument() bool  { return true }

// Provision delega al código existente en nfc_terminal.go via el handler API.
// El código real de provisionamiento Classic vive en NFCTerminals.ProvisionClassicCard.
// Este driver es un placeholder para el registry — la lógica real se invoca
// desde el handler API que ya existe.
func (d *ClassicDriver) Provision(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
	return nil, fmt.Errorf("Classic provision se maneja via NFCTerminals.ProvisionClassicCard — usar el handler API existente")
}

// PreAuth delega al código existente.
func (d *ClassicDriver) PreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
	return nil, fmt.Errorf("Classic pre-auth se maneja via NFCTerminals.ClassicPreAuth — usar el handler API existente")
}

// Confirm delega al código existente.
func (d *ClassicDriver) Confirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error) {
	return nil, fmt.Errorf("Classic confirm se maneja via NFCTerminals.ConfirmClassicTransaction — usar el handler API existente")
}

// CleanupExpired delega al código existente.
func (d *ClassicDriver) CleanupExpired(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) error {
	_, err := pool.Exec(ctx, `DELETE FROM nfc_classic_pending WHERE expires_at < NOW()`)
	return err
}
