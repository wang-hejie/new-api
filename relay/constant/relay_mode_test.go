package constant

import "testing"

func TestPath2RelayModeImagesEdits(t *testing.T) {
	tests := []struct {
		name string
		path string
		want int
	}{
		{
			name: "playground image edits",
			path: "/pg/images/edits",
			want: RelayModeImagesEdits,
		},
		{
			name: "v1 image edits",
			path: "/v1/images/edits",
			want: RelayModeImagesEdits,
		},
		{
			name: "playground image generations",
			path: "/pg/images/generations",
			want: RelayModeImagesGenerations,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Path2RelayMode(tt.path); got != tt.want {
				t.Fatalf("Path2RelayMode(%q) = %d, want %d", tt.path, got, tt.want)
			}
		})
	}
}
