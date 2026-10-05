package main

import (
	"bytes"
	"compress/flate"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"strings"
)

// Team holds what the team code carries: broker, topic and encryption key.
type Team struct {
	Host  string `json:"h"`
	WPort int    `json:"wp"`
	TPort int    `json:"tp"`
	TLS   *bool  `json:"s,omitempty"`
	User  string `json:"u,omitempty"`
	Pass  string `json:"p,omitempty"`
	Topic string `json:"t"`
	Key   string `json:"k"`
	Name  string `json:"n,omitempty"`
	R     string `json:"r,omitempty"` // our relay (overrides the default)
	key   []byte
	gcm   cipher.AEAD
}

func parseTeam(code string) (*Team, error) {
	code = strings.TrimSpace(code)
	if !strings.HasPrefix(code, "DE1-") {
		return nil, errors.New("codice squadra non valido")
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(code[4:], "="))
	if err != nil {
		return nil, errors.New("codice squadra non valido")
	}
	t := &Team{}
	if err := json.Unmarshal(raw, t); err != nil || t.Host == "" || t.Topic == "" {
		return nil, errors.New("codice squadra non valido")
	}
	t.key, err = base64.RawURLEncoding.DecodeString(strings.TrimRight(t.Key, "="))
	if err != nil || len(t.key) != 32 {
		return nil, errors.New("chiave del codice squadra non valida")
	}
	blk, _ := aes.NewCipher(t.key)
	t.gcm, _ = cipher.NewGCM(blk)
	if t.TPort == 0 {
		t.TPort = 8883
	}
	return t, nil
}

func (t *Team) useTLS() bool { return t.TLS == nil || *t.TLS }

// open: the reverse of seal (messages from the Regia).
func (t *Team) open(b []byte) ([]byte, error) {
	if len(b) < 13 {
		return nil, errors.New("messaggio corto")
	}
	z, err := t.gcm.Open(nil, b[:12], b[12:], nil)
	if err != nil {
		return nil, err
	}
	return io.ReadAll(io.LimitReader(flate.NewReader(bytes.NewReader(z)), 256<<10))
}

// seal: JSON → raw deflate → AES-256-GCM (12-byte nonce in front).
func (t *Team) seal(js []byte) []byte {
	var b bytes.Buffer
	w, _ := flate.NewWriter(&b, 5)
	w.Write(js)
	w.Close()
	nonce := make([]byte, 12)
	rand.Read(nonce)
	return t.gcm.Seal(nonce, nonce, b.Bytes(), nil)
}
