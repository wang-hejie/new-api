package controller

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
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

func TestIsImageGenerationModelGeminiNativePrefix(t *testing.T) {
	positives := []string{
		"gemini-2.5-flash-image",
		"gemini-3-pro-image-preview",
		"gemini-3.1-flash-image-preview",
	}
	negatives := []string{
		"gemini-2.5-flash",
		"gemini-2.5-pro",
		"gemini-2.5-flash-image-preview",
		"gemini-2.5-flash-image-preview-extra",
		"gemini-1.5-flash",
		"gemini-3-pro",
		"gemini-embedding-001",
	}

	for _, model := range positives {
		t.Run("positive/"+model, func(t *testing.T) {
			if !common.IsImageGenerationModel(model) {
				t.Fatalf("expected %s to be image-generation model", model)
			}
		})
	}
	for _, model := range negatives {
		t.Run("negative/"+model, func(t *testing.T) {
			if common.IsImageGenerationModel(model) {
				t.Fatalf("expected %s NOT to be image-generation model", model)
			}
		})
	}
}

func TestPlaygroundGeminiNativeImageMetadata(t *testing.T) {
	for _, model := range []string{
		"gemini-2.5-flash-image",
		"gemini-3-pro-image-preview",
		"gemini-3.1-flash-image-preview",
	} {
		t.Run(model, func(t *testing.T) {
			mode, params := getPlaygroundImageGenerationMetadata(model)
			if mode != "gemini_native" {
				t.Fatalf("mode = %q, want gemini_native", mode)
			}
			if params == nil {
				t.Fatalf("params is nil")
			}
			if params.Size || params.Quality || params.ResponseFormat {
				t.Fatalf("params = %#v, want size/quality/response_format disabled", params)
			}
			if params.NMax != 1 {
				t.Fatalf("n_max = %d, want 1", params.NMax)
			}
		})
	}

	mode, params := getPlaygroundImageGenerationMetadata("gemini-2.5-flash")
	if mode != "" || params != nil {
		t.Fatalf("text Gemini metadata = (%q, %#v), want empty metadata", mode, params)
	}
}

func TestPlaygroundModelInfoGeminiNativeImageJSONShape(t *testing.T) {
	mode, params := getPlaygroundImageGenerationMetadata("gemini-3.1-flash-image-preview")
	info := PlaygroundModelInfo{
		Name: "gemini-3.1-flash-image-preview",
		EndpointTypes: []constant.EndpointType{
			constant.EndpointTypeImageGeneration,
			constant.EndpointTypeGemini,
			constant.EndpointTypeOpenAI,
		},
		ImageGenerationMode: mode,
		ImageParameters:     params,
	}

	body, err := common.Marshal(info)
	if err != nil {
		t.Fatalf("marshal playground model info: %v", err)
	}
	bodyText := string(body)
	for _, want := range []string{
		`"endpoint_types":["image-generation","gemini","openai"]`,
		`"image_generation_mode":"gemini_native"`,
		`"image_parameters":{`,
		`"size":false`,
		`"quality":false`,
		`"response_format":false`,
		`"n_max":1`,
	} {
		if !strings.Contains(bodyText, want) {
			t.Fatalf("JSON %s does not contain %s", bodyText, want)
		}
	}

	plainInfo := PlaygroundModelInfo{
		Name:          "gemini-2.5-flash",
		EndpointTypes: []constant.EndpointType{constant.EndpointTypeGemini, constant.EndpointTypeOpenAI},
	}
	plainBody, err := common.Marshal(plainInfo)
	if err != nil {
		t.Fatalf("marshal plain playground model info: %v", err)
	}
	plainText := string(plainBody)
	if strings.Contains(plainText, "image_generation_mode") || strings.Contains(plainText, "image_parameters") {
		t.Fatalf("plain model JSON %s should omit Gemini image metadata", plainText)
	}
}
