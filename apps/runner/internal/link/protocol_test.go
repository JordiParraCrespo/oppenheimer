package link_test

import (
	"bytes"
	"encoding/json"
	"go/format"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"slices"
	"sort"
	"strings"
	"testing"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// These tests hold protocol.gen.go to the contract it was generated from.
// The generator runs in `pnpm --filter @oppenheimer/shared build`; what they
// catch is the build that changed the schema and not the Go, and a hand edit
// of the generated file.

// sharedFile reads a file of packages/shared/protocol-schema; the repository
// root is four directories above this one.
func sharedFile(t *testing.T, name string) []byte {
	t.Helper()
	_, here, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot locate this test file")
	}
	path := filepath.Join(filepath.Dir(here), "..", "..", "..", "..", "packages", "shared", "protocol-schema", name)
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		t.Skipf("%s is absent; it is committed in the repository, so this only happens outside it", path)
	}
	if err != nil {
		t.Fatal(err)
	}
	return data
}

type schemaNode struct {
	Type        any                    `json:"type"`
	Ref         string                 `json:"$ref"`
	AnyOf       []schemaNode           `json:"anyOf"`
	Items       *schemaNode            `json:"items"`
	Properties  map[string]*schemaNode `json:"properties"`
	Required    []string               `json:"required"`
	Default     any                    `json:"default"`
	Const       any                    `json:"const"`
	Constants   map[string]any         `json:"x-constants"`
	Definitions map[string]*schemaNode `json:"$defs"`
}

func protocolSchema(t *testing.T) schemaNode {
	t.Helper()
	var schema schemaNode
	if err := json.Unmarshal(sharedFile(t, "protocol.schema.json"), &schema); err != nil {
		t.Fatal(err)
	}
	return schema
}

func samples(t *testing.T) map[string]json.RawMessage {
	t.Helper()
	var all map[string]json.RawMessage
	if err := json.Unmarshal(sharedFile(t, "samples.json"), &all); err != nil {
		t.Fatal(err)
	}
	return all
}

// TestEveryTypeScriptSampleDecodesStrictly is the drift test: a field Zod
// has and the generated struct does not is an unknown field here.
func TestEveryTypeScriptSampleDecodesStrictly(t *testing.T) {
	for messageType, raw := range samples(t) {
		t.Run(messageType, func(t *testing.T) {
			v, ok := link.NewMessage(messageType)
			if !ok {
				t.Fatalf("no Go struct for %q", messageType)
			}
			decoder := json.NewDecoder(bytes.NewReader(raw))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(v); err != nil {
				t.Fatalf("the TypeScript sample does not decode into %T: %v", v, err)
			}
			encoded, err := json.Marshal(v)
			if err != nil {
				t.Fatal(err)
			}
			var want, got any
			if err := json.Unmarshal(raw, &want); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(encoded, &got); err != nil {
				t.Fatal(err)
			}
			if diff := jsonDiff("", want, got); diff != "" {
				t.Fatalf("%T does not round-trip the sample: %s\n sample: %s\n    got: %s", v, diff, raw, encoded)
			}
		})
	}
}

// jsonDiff compares two decoded JSON values. A key the sample leaves out may
// come back as its zero value: an optional field Go sends empty is the same
// message as one left out.
func jsonDiff(path string, want, got any) string {
	wantObject, isObject := want.(map[string]any)
	if !isObject {
		if !reflect.DeepEqual(want, got) {
			return path + ": want " + marshal(want) + ", got " + marshal(got)
		}
		return ""
	}
	gotObject, ok := got.(map[string]any)
	if !ok {
		return path + ": want an object, got " + marshal(got)
	}
	for key, value := range wantObject {
		if diff := jsonDiff(path+"."+key, value, gotObject[key]); diff != "" {
			return diff
		}
	}
	for key, value := range gotObject {
		if _, sent := wantObject[key]; !sent && !isZero(value) {
			return path + "." + key + ": the sample leaves it out, got " + marshal(value)
		}
	}
	return ""
}

func isZero(value any) bool {
	switch v := value.(type) {
	case nil:
		return true
	case string:
		return v == ""
	case float64:
		return v == 0
	case bool:
		return !v
	case []any:
		return len(v) == 0
	case map[string]any:
		return len(v) == 0
	}
	return false
}

func marshal(v any) string {
	out, _ := json.Marshal(v)
	return string(out)
}

func TestEveryMessageTypeHasASampleAndAStruct(t *testing.T) {
	schema := protocolSchema(t)
	var branches []string
	for _, branch := range schema.AnyOf {
		branches = append(branches, branch.Properties["type"].Const.(string))
	}
	sampled := make([]string, 0)
	for messageType := range samples(t) {
		sampled = append(sampled, messageType)
	}
	generated := slices.Clone(link.MessageTypes)
	sort.Strings(branches)
	sort.Strings(sampled)
	sort.Strings(generated)
	if !slices.Equal(generated, branches) {
		t.Fatalf("MessageTypes %v, the schema %v", generated, branches)
	}
	if !slices.Equal(sampled, branches) {
		t.Fatalf("samples %v, the schema %v", sampled, branches)
	}
	for _, messageType := range link.MessageTypes {
		if _, ok := link.NewMessage(messageType); !ok {
			t.Errorf("no struct for %q", messageType)
		}
	}
	if _, ok := link.NewMessage("nope"); ok {
		t.Error("an unknown type must not have a struct")
	}
}

// TestEveryStructMatchesItsSchema catches what no sample exercises: an
// optional property the samples leave out still needs a field, and a
// required one must not be omitempty.
func TestEveryStructMatchesItsSchema(t *testing.T) {
	schema := protocolSchema(t)
	for _, branch := range schema.AnyOf {
		messageType := branch.Properties["type"].Const.(string)
		v, ok := link.NewMessage(messageType)
		if !ok {
			t.Errorf("no struct for %q", messageType)
			continue
		}
		matchObject(t, messageType, reflect.TypeOf(v).Elem(), &branch, schema.Definitions)
	}
}

func matchObject(t *testing.T, path string, goType reflect.Type, node *schemaNode, defs map[string]*schemaNode) {
	t.Helper()
	fields := jsonFields(goType)
	if got, want := sortedKeys(fields), sortedKeys(node.Properties); !slices.Equal(got, want) {
		t.Errorf("%s: %s has json fields %v, the schema %v", path, goType, got, want)
		return
	}
	for key, property := range node.Properties {
		field := fields[key]
		required := slices.Contains(node.Required, key)
		if required && field.omitempty {
			t.Errorf("%s.%s is required but omitempty", path, key)
		}
		if !required && property.Default == nil && !field.omitempty {
			t.Errorf("%s.%s is optional but always sent", path, key)
		}
		// Follow inline objects and generated defs; the runner's own structs
		// (hostFacts) have their own test below.
		inner, fieldType := property, field.typ
		for inner.Items != nil || len(inner.AnyOf) > 0 {
			if inner.Items != nil {
				inner = inner.Items
			} else {
				inner = &inner.AnyOf[0]
			}
		}
		if inner.Ref != "" {
			name := strings.TrimPrefix(inner.Ref, "#/$defs/")
			if name == "hostFacts" {
				continue
			}
			inner = defs[name]
		}
		if inner.Type != "object" {
			continue
		}
		for fieldType.Kind() == reflect.Pointer || fieldType.Kind() == reflect.Slice {
			fieldType = fieldType.Elem()
		}
		matchObject(t, path+"."+key, fieldType, inner, defs)
	}
}

type jsonField struct {
	typ       reflect.Type
	omitempty bool
}

// jsonFields is a struct's fields by json name, embedded structs flattened
// the way encoding/json flattens them.
func jsonFields(goType reflect.Type) map[string]jsonField {
	fields := map[string]jsonField{}
	for i := range goType.NumField() {
		field := goType.Field(i)
		tag, hasTag := field.Tag.Lookup("json")
		if field.Anonymous && !hasTag {
			for name, inner := range jsonFields(field.Type) {
				fields[name] = inner
			}
			continue
		}
		if !field.IsExported() || tag == "-" {
			continue
		}
		name, options, _ := strings.Cut(tag, ",")
		fields[name] = jsonField{typ: field.Type, omitempty: slices.Contains(strings.Split(options, ","), "omitempty")}
	}
	return fields
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// The schema's hostFacts is the runner's Facts, verbatim: the schema follows
// the struct, so the struct is not generated and this holds them together.
func TestHostFactsMatchesTheSchema(t *testing.T) {
	schema := protocolSchema(t)
	matchObject(t, "hostFacts", reflect.TypeOf(hostdomain.Facts{}), schema.Definitions["hostFacts"], schema.Definitions)
}

func TestHostToolMatchesTheSchema(t *testing.T) {
	schema := protocolSchema(t)
	matchObject(t, "hostTool", reflect.TypeOf(hostdomain.Tool{}), schema.Definitions["hostTool"], schema.Definitions)
}

func TestGeneratedFileIsGofmtClean(t *testing.T) {
	source, err := os.ReadFile("protocol.gen.go")
	if err != nil {
		t.Fatal(err)
	}
	formatted, err := format.Source(source)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(formatted, source) {
		t.Fatal("protocol.gen.go is not gofmt-clean; fix packages/shared/scripts/emit-link-protocol.cjs, not the file")
	}
}

// TestConstantsMatchTheSchema is belt and braces against a hand edit of
// protocol.gen.go: the constants are the schema's x-constants.
func TestConstantsMatchTheSchema(t *testing.T) {
	var constants struct {
		ProtocolVersion      int               `json:"protocolVersion"`
		CloseCodes           map[string]int    `json:"closeCodes"`
		RefusalHeader        string            `json:"refusalHeader"`
		Refusals             map[string]string `json:"refusals"`
		FrameHeaderBytes     int               `json:"frameHeaderBytes"`
		CreditWindowBytes    int               `json:"creditWindowBytes"`
		MaxFrameBytes        int               `json:"maxFrameBytes"`
		Capabilities         []string          `json:"capabilities"`
		MaxEventPayloadBytes int               `json:"maxEventPayloadBytes"`
	}
	var schema struct {
		Constants json.RawMessage `json:"x-constants"`
	}
	if err := json.Unmarshal(sharedFile(t, "protocol.schema.json"), &schema); err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(bytes.NewReader(schema.Constants))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&constants); err != nil {
		t.Fatalf("x-constants: %v", err)
	}
	for name, pair := range map[string][2]any{
		"protocolVersion":      {constants.ProtocolVersion, link.ProtocolVersion},
		"HELLO_EXPECTED":       {constants.CloseCodes["HELLO_EXPECTED"], link.CloseHelloExpected},
		"HELLO_TIMEOUT":        {constants.CloseCodes["HELLO_TIMEOUT"], link.CloseHelloTimeout},
		"REPLACED":             {constants.CloseCodes["REPLACED"], link.CloseReplaced},
		"UNPAIRED":             {constants.CloseCodes["UNPAIRED"], link.CloseUnpaired},
		"PROTOCOL_MISMATCH":    {constants.CloseCodes["PROTOCOL_MISMATCH"], link.CloseProtocolMismatch},
		"refusalHeader":        {constants.RefusalHeader, link.RefusalHeader},
		"refusals.UNPAIRED":    {constants.Refusals["UNPAIRED"], link.RefusalUnpaired},
		"frameHeaderBytes":     {constants.FrameHeaderBytes, link.FrameHeader},
		"creditWindowBytes":    {constants.CreditWindowBytes, link.CreditWindow},
		"maxFrameBytes":        {constants.MaxFrameBytes, link.MaxFrameBytes},
		"maxEventPayloadBytes": {constants.MaxEventPayloadBytes, link.MaxEventPayloadBytes},
	} {
		if pair[0] != pair[1] {
			t.Errorf("%s: the schema says %v, protocol.gen.go %v", name, pair[0], pair[1])
		}
	}
	if len(constants.CloseCodes) != 5 || len(constants.Refusals) != 1 {
		t.Errorf("x-constants gained a close code or a refusal this test does not check: %v %v", constants.CloseCodes, constants.Refusals)
	}
	if !slices.Equal(constants.Capabilities, []string{link.CapabilitySessionImage, link.CapabilitySessionCreateImages}) {
		t.Errorf("capabilities: the schema says %v", constants.Capabilities)
	}
}
