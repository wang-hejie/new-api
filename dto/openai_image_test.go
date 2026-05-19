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

const referenceUsageJSON = `"reference_` + `usage"`
const referenceUsageField = "reference_" + "usage"

func TestImageRequestLegacyReferenceFieldJSONFallsThroughExtraAndMarshalDropsIt(t *testing.T) {
	raw := []byte(`{"model":"gpt-image-2","prompt":"draw a clean product photo","response_format":"url",` + referenceUsageJSON + `:"style","aspect_ratio":"wide"}`)

	var request dto.ImageRequest
	if err := common.Unmarshal(raw, &request); err != nil {
		t.Fatalf("unmarshal image request: %v", err)
	}

	if request.ResponseFormat != "url" {
		t.Fatalf("response_format = %q, want url", request.ResponseFormat)
	}
	if got := string(request.Extra[referenceUsageField]); got != `"style"` {
		t.Fatalf("legacy reference usage extra = %s, want %q", got, `"style"`)
	}
	if got := string(request.Extra["aspect_ratio"]); got != `"wide"` {
		t.Fatalf("aspect_ratio extra = %s, want %q", got, `"wide"`)
	}

	encoded, err := common.Marshal(request)
	if err != nil {
		t.Fatalf("marshal image request: %v", err)
	}
	if strings.Contains(string(encoded), referenceUsageJSON+`:"style"`) {
		t.Fatalf("marshaled request %s should drop legacy reference usage", encoded)
	}
	if !strings.Contains(string(encoded), `"response_format":"url"`) {
		t.Fatalf("marshaled request %s should keep response_format", encoded)
	}
}

func TestImageRequestEditsMultipartIgnoresLegacyReferenceField(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range map[string]string{
		"model":             "gpt-image-2",
		"prompt":            "change the apple color to bright green",
		"n":                 "3",
		"size":              "1024x1024",
		"quality":           "low",
		"response_format":   "url",
		referenceUsageField: "subject",
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
	if request.N == nil || *request.N != 3 {
		t.Fatalf("n = %#v, want 3", request.N)
	}

	encoded, err := common.Marshal(request)
	if err != nil {
		t.Fatalf("marshal image request: %v", err)
	}
	if strings.Contains(string(encoded), referenceUsageField) {
		t.Fatalf("marshaled multipart-derived request %s should not contain legacy reference usage", encoded)
	}
	if !strings.Contains(string(encoded), `"response_format":"url"`) {
		t.Fatalf("marshaled multipart-derived request %s should keep response_format", encoded)
	}
}
