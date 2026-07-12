package auth

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const confirmTTL = 60 * time.Second

var (
	ErrConfirmInvalid = errors.New("invalid confirmation token")
	ErrConfirmExpired = errors.New("confirmation token expired")
	ErrConfirmUsed    = errors.New("confirmation token already used")
	ErrConfirmMismatch = errors.New("confirmation token action mismatch")
)

type confirmClaims struct {
	Action   string `json:"act"`
	Target   string `json:"tgt"`
	TokenTyp string `json:"typ"`
	jwt.RegisteredClaims
}

func (s *Store) IssueConfirmToken(secret []byte, deviceID, action, target string) (string, int, error) {
	if deviceID == "" || action == "" {
		return "", 0, errors.New("invalid confirm request")
	}
	jti, err := randomToken(16)
	if err != nil {
		return "", 0, err
	}
	now := time.Now()
	claims := confirmClaims{
		Action:   action,
		Target:   target,
		TokenTyp: "agent-confirm",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   deviceID,
			ID:        jti,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(confirmTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		return "", 0, err
	}
	if err := s.rememberConfirmJTI(jti, now.Add(confirmTTL)); err != nil {
		return "", 0, err
	}
	return signed, int(confirmTTL.Seconds()), nil
}

func (s *Store) ConsumeConfirmToken(secret []byte, tokenString, action, target string) error {
	token, err := jwt.ParseWithClaims(tokenString, &confirmClaims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil || !token.Valid {
		return ErrConfirmInvalid
	}
	claims, ok := token.Claims.(*confirmClaims)
	if !ok || claims.TokenTyp != "agent-confirm" {
		return ErrConfirmInvalid
	}
	if claims.Action != action || claims.Target != target {
		return ErrConfirmMismatch
	}
	if claims.ID == "" {
		return ErrConfirmInvalid
	}
	return s.consumeConfirmJTI(claims.ID)
}

func (s *Store) rememberConfirmJTI(jti string, expires time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	used, err := s.loadConfirmJTIsLocked()
	if err != nil {
		return err
	}
	now := time.Now()
	for id, exp := range used {
		if now.After(exp) {
			delete(used, id)
		}
	}
	used[jti] = expires
	return s.saveConfirmJTIsLocked(used)
}

func (s *Store) consumeConfirmJTI(jti string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	used, err := s.loadConfirmJTIsLocked()
	if err != nil {
		return err
	}
	exp, ok := used[jti]
	if !ok {
		return ErrConfirmUsed
	}
	delete(used, jti)
	if err := s.saveConfirmJTIsLocked(used); err != nil {
		return err
	}
	if time.Now().After(exp) {
		return ErrConfirmExpired
	}
	return nil
}

func (s *Store) loadConfirmJTIsLocked() (map[string]time.Time, error) {
	path := filepath.Join(s.dir, "confirm-jti.json")
	var m map[string]time.Time
	if err := readJSON(path, &m); err != nil {
		if os.IsNotExist(err) {
			return map[string]time.Time{}, nil
		}
		return nil, err
	}
	if m == nil {
		m = map[string]time.Time{}
	}
	return m, nil
}

func (s *Store) saveConfirmJTIsLocked(m map[string]time.Time) error {
	return writeJSON(filepath.Join(s.dir, "confirm-jti.json"), m)
}
