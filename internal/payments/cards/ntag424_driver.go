package cards

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NTAG424Driver es un placeholder para NTAG424 DNA.
// NTAG424 usa AES-128 + SUN (Secure Unique Messaging) con MAC dinámico.
// No necesita certificados rotativos porque el MAC ya es dinámico por lectura.
// La implementación completa del protocolo SUN se hará en el futuro.
type NTAG424Driver struct {
	manifest CardManifest
}

func init() {
	Register(&NTAG424Driver{
		manifest: CardManifest{
			Type:         "ntag424",
			DisplayName:  "NTAG424 DNA",
			Description:  "Tarjeta NFC Type 4 con AES-128 y SUN (Secure Unique Messaging). MAC dinamico por lectura.",
			Manufacturer: "NXP Semiconductors",
			Capacity:     "full",
			Memory: MemSpec{
				TotalBytes: 416, UserBytes: 416,
			},
			Security: SecuritySpec{
				Level: "aes", Algorithm: "AES-128",
				KeyLengthBits: 128, KeyCount: 5,
				MutualAuth: true, SecureMessaging: true,
				CryptoPerSlot: false, OriginalitySignature: true,
				SunMac: true,
				Notes:   "SUN genera MAC dinamico por lectura. No necesita certificados rotativos.",
			},
			Compatibility: CompatibilitySpec{
				Android: "full", IOS: "full", ESP32PN532: "full",
				PhoneReader: true, NFCForumType: 4,
				Notes:       "Universal — funciona en todos los telefonos",
			},
			Protocol: ProtocolSpec{
				Slots: 0, AuthMethod: "AES-128_SUN",
				Rotation: "none", PreAuthTTLSeconds: 30,
				Notes: "No usa certificados rotativos. El MAC SUN es dinamico por lectura.",
			},
			Availability: AvailabilitySpec{
				Venezuela: false, PriceUSD: 0.50,
				Notes:     "Dificil de conseguir en Venezuela. Alta seguridad si se consigue.",
			},
			Endpoints: EndpointsSpec{
				Provision: "/api/nfc/cards/provision-ntag424",
				PreAuth:   "/api/nfc/terminal/ntag424/pre-auth",
				Confirm:   "/api/nfc/terminal/ntag424/confirm",
			},
			Docs: []string{"docs/nfc_hardware.md"},
		},
	})
}

func (d *NTAG424Driver) GetType() string         { return "ntag424" }
func (d *NTAG424Driver) GetManifest() CardManifest { return d.manifest }
func (d *NTAG424Driver) RequiresDocument() bool  { return false }

func (d *NTAG424Driver) Provision(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
	return nil, fmt.Errorf("NTAG424 provision no implementado — protocolo SUN futuro")
}

func (d *NTAG424Driver) PreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
	return nil, fmt.Errorf("NTAG424 pre-auth no implementado — protocolo SUN futuro")
}

func (d *NTAG424Driver) Confirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error) {
	return nil, fmt.Errorf("NTAG424 confirm no implementado — protocolo SUN futuro")
}

func (d *NTAG424Driver) CleanupExpired(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) error {
	return nil
}
