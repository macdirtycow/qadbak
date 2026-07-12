package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	accessTTL        = 15 * time.Minute
	refreshTTL       = 90 * 24 * time.Hour
	pairingTTL       = 10 * time.Minute
	refreshTokenPrefix = "qar_"
)

type Store struct {
	dir string
	mu  sync.Mutex
}

type refreshRecord struct {
	Hash      string    `json:"hash"`
	DeviceID  string    `json:"deviceId"`
	Label     string    `json:"label"`
	ExpiresAt time.Time `json:"expiresAt"`
	Revoked   bool      `json:"revoked"`
}

type pairingState struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func NewStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}
	return &Store{dir: dir}, nil
}

func (s *Store) IssuePairingToken() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	state := pairingState{
		Token:     token,
		ExpiresAt: time.Now().Add(pairingTTL),
	}
	if err := writeJSON(filepath.Join(s.dir, "pairing.json"), state); err != nil {
		return "", err
	}
	return token, nil
}

func (s *Store) ConsumePairingToken(given string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	path := filepath.Join(s.dir, "pairing.json")
	var state pairingState
	if err := readJSON(path, &state); err != nil {
		return errors.New("pairing unavailable")
	}
	if time.Now().After(state.ExpiresAt) {
		_ = os.Remove(path)
		return errors.New("pairing token expired")
	}
	if state.Token != given {
		return errors.New("invalid pairing token")
	}
	_ = os.Remove(path)
	return nil
}

func (s *Store) CreateSession(secret []byte, deviceID, label string) (access string, refresh string, expiresIn int, err error) {
	refresh, err = randomToken(32)
	if err != nil {
		return "", "", 0, err
	}
	rec := refreshRecord{
		Hash:      hashToken(refresh),
		DeviceID:  deviceID,
		Label:     label,
		ExpiresAt: time.Now().Add(refreshTTL),
	}
	s.mu.Lock()
	tokens, _ := s.loadRefreshTokensLocked()
	tokens[rec.Hash] = rec
	if err := s.saveRefreshTokensLocked(tokens); err != nil {
		s.mu.Unlock()
		return "", "", 0, err
	}
	s.mu.Unlock()

	access, err = s.signAccess(secret, deviceID, label)
	if err != nil {
		return "", "", 0, err
	}
	return access, refresh, int(accessTTL.Seconds()), nil
}

func (s *Store) Rotate(secret []byte, refreshToken string) (access string, newRefresh string, expiresIn int, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	tokens, err := s.loadRefreshTokensLocked()
	if err != nil {
		return "", "", 0, err
	}
	hash := hashToken(refreshToken)
	rec, ok := tokens[hash]
	if !ok || rec.Revoked || time.Now().After(rec.ExpiresAt) {
		return "", "", 0, errors.New("invalid refresh token")
	}
	delete(tokens, hash)
	newRefresh, err = randomToken(32)
	if err != nil {
		return "", "", 0, err
	}
	newRec := refreshRecord{
		Hash:      hashToken(newRefresh),
		DeviceID:  rec.DeviceID,
		Label:     rec.Label,
		ExpiresAt: time.Now().Add(refreshTTL),
	}
	tokens[newRec.Hash] = newRec
	if err := s.saveRefreshTokensLocked(tokens); err != nil {
		return "", "", 0, err
	}
	access, err = s.signAccess(secret, rec.DeviceID, rec.Label)
	if err != nil {
		return "", "", 0, err
	}
	return access, newRefresh, int(accessTTL.Seconds()), nil
}

func (s *Store) ValidateAccess(secret []byte, tokenString string) (deviceID string, err error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil || !token.Valid {
		return "", errors.New("invalid access token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid claims")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return "", errors.New("missing subject")
	}
	return sub, nil
}

func (s *Store) RevokeRefreshToken(refreshToken string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	tokens, err := s.loadRefreshTokensLocked()
	if err != nil {
		return err
	}
	hash := hashToken(refreshToken)
	rec, ok := tokens[hash]
	if !ok {
		return errors.New("invalid refresh token")
	}
	rec.Revoked = true
	tokens[hash] = rec
	return s.saveRefreshTokensLocked(tokens)
}

func (s *Store) signAccess(secret []byte, deviceID, label string) (string, error) {
	claims := jwt.MapClaims{
		"sub":   deviceID,
		"label": label,
		"typ":   "agent-access",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(accessTTL).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func (s *Store) loadRefreshTokensLocked() (map[string]refreshRecord, error) {
	path := filepath.Join(s.dir, "refresh-tokens.json")
	var tokens map[string]refreshRecord
	if err := readJSON(path, &tokens); err != nil {
		if os.IsNotExist(err) {
			return map[string]refreshRecord{}, nil
		}
		return nil, err
	}
	if tokens == nil {
		tokens = map[string]refreshRecord{}
	}
	return tokens, nil
}

func (s *Store) saveRefreshTokensLocked(tokens map[string]refreshRecord) error {
	return writeJSON(filepath.Join(s.dir, "refresh-tokens.json"), tokens)
}

func randomToken(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return refreshTokenPrefix + hex.EncodeToString(buf), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func writeJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o600)
}
