# FBXLoader Module Dependency Graph

## Dependency Flow

```
┌─────────────────────────────────────────────────────────┐
│                     index.js (Entry)                     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   FBXLoader.js                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ - load()                                        │   │
│  │ - parse()                                       │   │
│  └─────────────────────────────────────────────────┘   │
└──┬────────┬─────────┬──────────────────────────────────┘
   │        │         │
   │        │         └──────────────┐
   │        │                        │
   ▼        ▼                        ▼
┌──────┐ ┌──────┐            ┌──────────────┐
│Binary│ │Text  │            │ FBXTreeParser│
│Parser│ │Parser│            │              │
└──┬───┘ └──┬───┘            └──────┬───────┘
   │        │                       │
   │        │                       ├──► GeometryParser
   │        │                       ├──► AnimationParser
   │        │                       └──► Materials/Textures
   │        │
   ▼        ▼
┌────────────────┐
│  BinaryReader  │
└────────────────┘

═══════════════════════════════════════════════════════════

            Shared Dependencies

┌─────────────┐   ┌──────────────┐   ┌──────────┐
│   context   │   │    utils     │   │  types   │
│  (state)    │   │  (helpers)   │   │ (models) │
└─────────────┘   └──────────────┘   └──────────┘
     ▲                   ▲                 ▲
     │                   │                 │
     └───────────────────┴─────────────────┘
              Used by all modules
```

## Import Graph (No Circular Dependencies)

```
Level 0 (Foundation):
  ├─ types/FBXTree.js
  ├─ utils/constants.js
  └─ shared/context.js

Level 1 (Basic Utilities):
  ├─ utils/typeUtils.js       → constants
  ├─ utils/dataUtils.js       → (standalone)
  └─ utils/transformUtils.js  → (standalone)

Level 2 (Data Readers):
  ├─ parsers/BinaryReader.js  → (standalone)
  └─ utils/index.js           → all utils/*

Level 3 (Format Parsers):
  ├─ parsers/BinaryParser.js  → BinaryReader, FBXTree, fflate
  └─ parsers/TextParser.js    → FBXTree, dataUtils

Level 4 (Domain Parsers):
  ├─ tree/GeometryParser.js   → context, dataUtils, transformUtils
  └─ tree/AnimationParser.js  → context, dataUtils

Level 5 (Tree Builder):
  └─ tree/FBXTreeParser.js    → context, GeometryParser, AnimationParser, transformUtils

Level 6 (Main Loader):
  └─ FBXLoader.js             → all parsers, FBXTreeParser, context, typeUtils

Level 7 (Entry Point):
  └─ index.js                 → FBXLoader
```

## Module Responsibilities

### Core Modules
- **index.js**: Public API entry point
- **FBXLoader.js**: Main loader orchestration, format detection
- **shared/context.js**: Global state management (fbxTree, connections, sceneGraph)

### Parsers
- **parsers/BinaryReader.js**: Low-level binary data reading
- **parsers/BinaryParser.js**: Binary FBX → tree structure
- **parsers/TextParser.js**: ASCII FBX → tree structure

### Tree Builders
- **tree/FBXTreeParser.js**: Main scene builder (1000 lines)
  - Materials & textures
  - Models & hierarchies
  - Cameras & lights
  - Skeleton binding
- **tree/GeometryParser.js**: Geometry builder (680 lines)
  - Mesh geometry
  - NURBS curves
  - Morph targets
- **tree/AnimationParser.js**: Animation builder (450 lines)
  - Animation curves
  - Keyframe tracks
  - Skeletal animations

### Utilities
- **utils/constants.js**: FBX format constants
- **utils/typeUtils.js**: Format detection & version checking
- **utils/dataUtils.js**: Array operations, time conversion
- **utils/transformUtils.js**: Matrix transformations (150 lines)
- **utils/index.js**: Barrel export for all utilities

### Types
- **types/FBXTree.js**: FBX tree data structure

## External Dependencies

```
three (Core Library)
  └─ BufferGeometry, Materials, Lights, Cameras, etc.

three/examples/jsm/curves/NURBSCurve.js
  └─ NURBS curve support

fflate (npm package)
  └─ Binary FBX decompression
```

## Data Flow

```
FBX File (Binary or ASCII)
      │
      ▼
┌──────────────┐
│  FBXLoader   │
└──────┬───────┘
       │
       ├─► Binary? → BinaryParser → BinaryReader
       │                    │
       └─► ASCII?  → TextParser
                            │
                            ▼
                    ┌───────────────┐
                    │   FBX Tree    │ (stored in context)
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │FBXTreeParser  │
                    └───────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │Geometry  │    │Animation │    │Materials │
    │Parser    │    │Parser    │    │Textures  │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         └───────────────┴───────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Three.js Group  │
                │  (Scene Graph)  │
                └─────────────────┘
```

## Key Design Decisions

1. **Shared Context**: Eliminates global variables, enables clean multi-file parsing
2. **Layered Architecture**: Foundation → Utils → Parsers → Builders → Loader
3. **Single Responsibility**: Each module has one clear purpose
4. **Dependency Injection**: Context passed to modules, not globally accessed
5. **No Circular Imports**: Strict unidirectional dependency flow
6. **Barrel Exports**: Utils grouped for convenience (`utils/index.js`)
7. **Type Clarity**: Dedicated `types/` folder for data structures
8. **Error Boundaries**: Each parser validates its input
9. **Format Agnostic**: Binary and Text parsers produce identical tree structure
10. **Three.js Alignment**: Follows Three.js conventions and import patterns
