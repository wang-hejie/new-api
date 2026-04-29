package dto_test

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/gin-gonic/gin"
)

func TestImageRequestReferenceUsageJSONAndExtraCompatibility(t *testing.T) {
	raw := []byte(`{
		"model":"gpt-image-2",
		"prompt":"draw a clean product photo",
		"response_format":"url",
		"reference_usage":"style",
		"aspect_ratio":"wide"
	}`)

	var request dto.ImageRequest
	if err := common.Unmarshal(raw, &request); err != nil {
		t.Fatalf("unmarshal image request: %v", err)
	}

	if request.ReferenceUsage == nil || *request.ReferenceUsage != "style" {
		t.Fatalf("reference_usage = %#v, want style", request.ReferenceUsage)
	}
	if request.ResponseFormat != "url" {
		t.Fatalf("response_format = %q, want url", request.ResponseFormat)
	}
	if _, ok := request.Extra["reference_usage"]; ok {
		t.Fatalf("reference_usage should be a known field, got Extra=%v", request.Extra)
	}
	if got := string(request.Extra["aspect_ratio"]); got != `"wide"` {
		t.Fatalf("aspect_ratio extra = %s, want %q", got, `"wide"`)
	}

	encoded, err := common.Marshal(request)
	if err != nil {
		t.Fatalf("marshal image request: %v", err)
	}
	if !strings.Contains(string(encoded), `"reference_usage":"style"`) {
		t.Fatalf("marshaled request %s should keep reference_usage", encoded)
	}
}

func TestImageRequestEditsMultipartReferenceUsageAndResponseFormat(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range map[string]string{
		"model":           "gpt-image-2",
		"prompt":          "change the apple color to bright green",
		"n":               "3",
		"size":            "1024x1024",
		"quality":         "low",
		"response_format": "url",
		"reference_usage": "subject",
	} {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatalf("write field %s: %v", key, err)
		}
	}
	filePart, err := writer.CreateFormFile("image", "apple.png")
	if err != nil {
		t.Fatalf("create image file part: %v", err)
	}
	if _, err := filePart.Write([]byte("fake image bytes")); err != nil {
		t.Fatalf("write image file part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	request, err := relayhelper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
	if err != nil {
		t.Fatalf("GetAndValidOpenAIImageRequest: %v", err)
	}

	if request.Model != "gpt-image-2" {
		t.Fatalf("model = %q, want gpt-image-2", request.Model)
	}
	if request.ResponseFormat != "url" {
		t.Fatalf("response_format = %q, want url", request.ResponseFormat)
	}
	if request.ReferenceUsage == nil || *request.ReferenceUsage != "subject" {
		t.Fatalf("reference_usage = %#v, want subject", request.ReferenceUsage)
	}
	if request.N == nil || *request.N != 3 {
		t.Fatalf("n = %#v, want 3", request.N)
	}
}
