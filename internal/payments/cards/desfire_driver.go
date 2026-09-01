package cards

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DesfireDriver es un placeholder para DESFire EV3.
// DESFire usa AES-128 real y no necesita certificados rotativos.
// La implementación completa del protocolo AES se hará en el futuro.
type DesfireDriver struct {
	manifest CardManifest
}

func init() {
	Register(&DesfireDriver{
		manifest: CardManifest{
			Type:         "desfire",
			DisplayName:  "MIFARE DESFire EV3",
			Description:  "Tarjeta NFC Type 4 con AES-128/256, multi-aplicacion. Alta seguridad EAL5+.",
			Manufacturer: "NXP Semiconductors",
			Capacity:     "full",
			Memory: MemSpec{
				TotalBytes: 4096, UserBytes: 4000,
			},
			Security: SecuritySpec{
				Level: "aes", Algorithm: "AES-128/192/256",
				KeyLengthBits: 128, KeyCount: 28,
				MutualAuth: true, SecureMessaging: true,
				CryptoPerSlot: false, OriginalitySignature: true,
				Certification: "Common Criteria EAL5+",
				Notes:         "AES real. No necesita certificados rotativos.",
			},
			Compatibility: CompatibilitySpec{
				Android: "full", IOS: "full", ESP32PN532: "full",
				PhoneReader: true, NFCForumType: 4,
				Notes:       "Universal — funciona en todos los telefonos",
			},
			Protocol: ProtocolSpec{
				Slots: 0, AuthMethod: "AES-128_mutual",
				Rotation: "none", PreAuthTTLSeconds: 30,
				Notes: "No usa certificados rotativos. AES-128 es suficiente.",
			},
			Availability: AvailabilitySpec{
				Venezuela: false, PriceUSD: 1.50,
				Notes:     "Muy dificil de conseguir en Venezuela.",
			},
			Endpoints: EndpointsSpec{
				Provision: "/api/nfc/cards/provision-desfire",
				PreAuth:   "/api/nfc/terminal/desfire/pre-auth",
				Confirm:   "/api/nfc/terminal/desfire/confirm",
			},
			Docs: []string{"docs/nfc_hardware.md"},
		},
	})
}

func (d *DesfireDriver) GetType() string         { return "desfire" }
func (d *DesfireDriver) GetManifest() CardManifest { return d.manifest }
func (d *DesfireDriver) RequiresDocument() bool  { return false }

func (d *DesfireDriver) Provision(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
	return nil, fmt.Errorf("DESFire provision no implementado — protocolo AES futuro")
}

func (d *DesfireDriver) PreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
	return nil, fmt.Errorf("DESFire pre-auth no implementado — protocolo AES futuro")
}

func (d *DesfireDriver) Confirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error) {
	return nil, fmt.Errorf("DESFire confirm no implementado — protocolo AES futuro")
}

func (d *DesfireDriver) CleanupExpired(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) error {
	return nil
}
