package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

func TestPlaygroundRelayFormatByPath(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		want    types.RelayFormat
		wantErr bool
	}{
		{
			name: "chat completions",
			path: "/pg/chat/completions",
			want: types.RelayFormatOpenAI,
		},
		{
			name: "image generations",
			path: "/pg/images/generations",
			want: types.RelayFormatOpenAIImage,
		},
		{
			name:    "unknown path",
			path:    "/pg/images/edits",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := playgroundRelayFormatByPath(tt.path)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("format = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestPlaygroundImageGenerationsRelayMode(t *testing.T) {
	got := relayconstant.Path2RelayMode("/pg/images/generations")
	if got != relayconstant.RelayModeImagesGenerations {
		t.Fatalf("relay mode = %d, want %d", got, relayconstant.RelayModeImagesGenerations)
	}
}

func TestIsImageGenerationModelGPTImagePrefix(t *testing.T) {
	models := []string{
		"gpt-image-1",
		"gpt-image-1.5",
		"gpt-image-1-mini",
		"gpt-image-2",
	}

	for _, model := range models {
		t.Run(model, func(t *testing.T) {
			if !common.IsImageGenerationModel(model) {
				t.Fatalf("expected %s to be recognized as image-generation model", model)
			}
		})
	}
}
