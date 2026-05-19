package openai

import (
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

type multipartPartSnapshot struct {
	Fields map[string][]string
	Files  map[string][]string
}

const referenceUsageField = "reference_" + "usage"

func buildOpenAIImageEditContext(t *testing.T, fields map[string]string) (*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatalf("write field %s: %v", key, err)
		}
	}
	imagePart, err := writer.CreateFormFile("image", "apple.png")
	if err != nil {
		t.Fatalf("create image file part: %v", err)
	}
	if _, err := imagePart.Write([]byte("fake image bytes")); err != nil {
		t.Fatalf("write image file part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	if _, err := c.MultipartForm(); err != nil {
		t.Fatalf("parse multipart form: %v", err)
	}

	request := dto.ImageRequest{
		Model:   fields["model"],
		Prompt:  fields["prompt"],
		Size:    fields["size"],
		Quality: fields["quality"],
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: fields["model"],
		},
	}

	return c, info, request
}

func parseMultipartSnapshot(t *testing.T, buffer *bytes.Buffer, contentType string) multipartPartSnapshot {
	t.Helper()

	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		t.Fatalf("parse content type %q: %v", contentType, err)
	}
	reader := multipart.NewReader(bytes.NewReader(buffer.Bytes()), params["boundary"])
	snapshot := multipartPartSnapshot{
		Fields: map[string][]string{},
		Files:  map[string][]string{},
	}

	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("next multipart part: %v", err)
		}
		name := part.FormName()
		if filename := part.FileName(); filename != "" {
			snapshot.Files[name] = append(snapshot.Files[name], filename)
			continue
		}
		value, err := io.ReadAll(part)
		if err != nil {
			t.Fatalf("read multipart field %s: %v", name, err)
		}
		snapshot.Fields[name] = append(snapshot.Fields[name], string(value))
	}

	return snapshot
}

func TestConvertImageRequestGPTImage2EditStripsUnsupportedMultipartFields(t *testing.T) {
	c, info, request := buildOpenAIImageEditContext(t, map[string]string{
		"model":              "gpt-image-2",
		"prompt":             "change the apple color to bright green",
		"group":              "default",
		"response_format":    "url",
		referenceUsageField:  "subject",
		"stream":             "true",
		"partial_images":     "1",
		"input_fidelity":     "high",
		"watermark":          "true",
		"n":                  "1",
		"size":               "1024x1024",
		"quality":            "auto",
		"output_format":      "png",
		"output_compression": "80",
		"background":         "auto",
		"moderation":         "low",
		"user":               "playground-user",
	})

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	if err != nil {
		t.Fatalf("ConvertImageRequest: %v", err)
	}
	buffer, ok := converted.(*bytes.Buffer)
	if !ok {
		t.Fatalf("converted request = %T, want *bytes.Buffer", converted)
	}

	snapshot := parseMultipartSnapshot(t, buffer, c.Request.Header.Get("Content-Type"))
	for key, want := range map[string]string{
		"model":              "gpt-image-2",
		"prompt":             "change the apple color to bright green",
		"n":                  "1",
		"size":               "1024x1024",
		"quality":            "auto",
		"output_format":      "png",
		"output_compression": "80",
		"background":         "auto",
		"moderation":         "low",
		"user":               "playground-user",
	} {
		if got := strings.Join(snapshot.Fields[key], ","); got != want {
			t.Fatalf("field %s = %q, want %q; fields=%v", key, got, want, snapshot.Fields)
		}
	}

	for _, key := range []string{
		"group",
		"response_format",
		referenceUsageField,
		"stream",
		"partial_images",
		"input_fidelity",
		"watermark",
	} {
		if _, ok := snapshot.Fields[key]; ok {
			t.Fatalf("field %s should be stripped for gpt-image-2; fields=%v", key, snapshot.Fields)
		}
	}
	if got := snapshot.Files["image"]; len(got) != 1 || got[0] != "apple.png" {
		t.Fatalf("image files = %#v, want apple.png", got)
	}
}

func TestConvertImageRequestGPTImage2EditStripsUnsupportedFieldsAfterModelMapping(t *testing.T) {
	c, info, request := buildOpenAIImageEditContext(t, map[string]string{
		"model":             "custom-image-edit-alias",
		"prompt":            "change the apple color to bright green",
		"group":             "default",
		"response_format":   "url",
		referenceUsageField: "subject",
		"size":              "1024x1024",
	})
	info.UpstreamModelName = "gpt-image-2"
	request.Model = "custom-image-edit-alias"

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	if err != nil {
		t.Fatalf("ConvertImageRequest: %v", err)
	}
	buffer, ok := converted.(*bytes.Buffer)
	if !ok {
		t.Fatalf("converted request = %T, want *bytes.Buffer", converted)
	}

	snapshot := parseMultipartSnapshot(t, buffer, c.Request.Header.Get("Content-Type"))
	for key, want := range map[string]string{
		"model":  "custom-image-edit-alias",
		"prompt": "change the apple color to bright green",
		"size":   "1024x1024",
	} {
		if got := strings.Join(snapshot.Fields[key], ","); got != want {
			t.Fatalf("field %s = %q, want %q; fields=%v", key, got, want, snapshot.Fields)
		}
	}
	for _, key := range []string{"group", "response_format", referenceUsageField} {
		if _, ok := snapshot.Fields[key]; ok {
			t.Fatalf("field %s should be stripped for mapped gpt-image-2; fields=%v", key, snapshot.Fields)
		}
	}
}

func TestConvertImageRequestNonGPTImage2EditKeepsMultipartPassthrough(t *testing.T) {
	c, info, request := buildOpenAIImageEditContext(t, map[string]string{
		"model":             "gpt-image-1",
		"prompt":            "change the apple color to bright green",
		"group":             "default",
		"response_format":   "url",
		referenceUsageField: "subject",
		"size":              "1024x1024",
	})

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	if err != nil {
		t.Fatalf("ConvertImageRequest: %v", err)
	}
	buffer, ok := converted.(*bytes.Buffer)
	if !ok {
		t.Fatalf("converted request = %T, want *bytes.Buffer", converted)
	}

	snapshot := parseMultipartSnapshot(t, buffer, c.Request.Header.Get("Content-Type"))
	for key, want := range map[string]string{
		"model":             "gpt-image-1",
		"prompt":            "change the apple color to bright green",
		"group":             "default",
		"response_format":   "url",
		referenceUsageField: "subject",
		"size":              "1024x1024",
	} {
		if got := strings.Join(snapshot.Fields[key], ","); got != want {
			t.Fatalf("field %s = %q, want %q; fields=%v", key, got, want, snapshot.Fields)
		}
	}
	if got := snapshot.Files["image"]; len(got) != 1 || got[0] != "apple.png" {
		t.Fatalf("image files = %#v, want apple.png", got)
	}
}
