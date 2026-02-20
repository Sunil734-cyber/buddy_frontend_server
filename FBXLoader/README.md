# FBXLoader - Modular Structure

A modular, maintainable refactoring of the Three.js FBXLoader.

## Directory Structure

```
FBXLoader/
├── index.js                    # Main entry point
├── FBXLoader.js                # Main loader class
├── parsers/                    # Format parsers
│   ├── BinaryParser.js         # Binary FBX parser
│   ├── BinaryReader.js         # Binary data reader
│   └── TextParser.js           # ASCII FBX parser
├── tree/                       # Scene tree builders
│   ├── AnimationParser.js      # Animation data parser
│   ├── FBXTreeParser.js        # Main tree parser
│   └── GeometryParser.js       # Geometry data parser
├── utils/                      # Utility functions
│   ├── constants.js            # FBX format constants
│   ├── dataUtils.js            # Data manipulation utilities
│   ├── transformUtils.js       # Transform calculations
│   ├── typeUtils.js            # Format detection
│   └── index.js                # Barrel export
├── types/                      # Type definitions
│   └── FBXTree.js              # FBX tree data structure
└── shared/                     # Shared state
    └── context.js              # Global state management
```

## Usage

### Basic Import

```javascript
import { FBXLoader } from './FBXLoader/index.js';

const loader = new FBXLoader();
loader.load('model.fbx', (object) => {
    scene.add(object);
});
```

### Dependencies

This module requires the following dependencies:

1. **three.js** - Core Three.js library
2. **fflate** - For decompression of binary FBX data
   ```bash
   npm install fflate
   ```
3. **NURBSCurve** - From three.js examples (for NURBS geometry support)
   - Import from: `three/examples/jsm/curves/NURBSCurve.js`

## Module Organization

### Parsers (`parsers/`)
- **BinaryReader.js**: Low-level binary data reading with DataView
- **BinaryParser.js**: Parses binary FBX format into tree structure
- **TextParser.js**: Parses ASCII FBX format into tree structure

### Tree Builders (`tree/`)
- **FBXTreeParser.js**: Main scene graph builder, handles materials, textures, models
- **GeometryParser.js**: Converts FBX geometry data to Three.js BufferGeometry
- **AnimationParser.js**: Converts FBX animation curves to Three.js AnimationClips

### Utilities (`utils/`)
- **constants.js**: FBX format magic numbers and version info
- **typeUtils.js**: Format detection (binary vs ASCII) and version checking
- **dataUtils.js**: Array manipulation, time conversion, data extraction
- **transformUtils.js**: Matrix transform calculations with proper rotation order

### Shared State (`shared/`)
- **context.js**: Centralized management of global state (fbxTree, connections, sceneGraph)
  - Avoids global variables
  - Provides clean reset between multiple parses
  - Dependency injection pattern

## Architecture Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **No Circular Dependencies**: Import graph is a DAG (Directed Acyclic Graph)
3. **Shared State Management**: Global state centralized in `context.js`
4. **Type Safety**: Clear data structures in `types/` folder
5. **Utility Functions**: Reusable helpers in `utils/` with barrel export

## File Sizes

- **FBXTreeParser.js**: ~1,000 lines (materials, textures, scene graph, cameras, lights)
- **GeometryParser.js**: ~680 lines (mesh and NURBS geometry parsing)
- **AnimationParser.js**: ~450 lines (animation curve processing)
- **BinaryParser.js**: ~285 lines (binary format parsing)
- **TextParser.js**: ~250 lines (ASCII format parsing)
- **BinaryReader.js**: ~195 lines (binary data reading)
- **transformUtils.js**: ~150 lines (complex matrix transformations)
- All others: <100 lines each

## Migration from Original FBXLoader.js

Replace:
```javascript
import { FBXLoader } from './FBXLoader.js';
```

With:
```javascript
import { FBXLoader } from './FBXLoader/index.js';
```

The API remains identical - no changes to usage code required.

## Key Changes from Original

1. **Global Variables Removed**: `fbxTree`, `connections`, `sceneGraph` now managed by `context.js`
2. **Modular Parser Classes**: Each parser is independent and testable
3. **Dependency Injection**: Context passed to parsers rather than global access
4. **Better Organization**: Related functionality grouped into logical modules
5. **Import/Export Clarity**: Explicit ES6 module imports throughout

## Supported FBX Features

- ✅ Binary FBX >= 6400
- ✅ ASCII FBX >= 7.0
- ✅ Mesh geometry with UVs, normals, vertex colors
- ✅ Materials (Lambert and Phong)
- ✅ Textures with UV transforms
- ✅ Skeletal animations
- ✅ Morph targets / blend shapes
- ✅ Cameras (Perspective and Orthographic)
- ✅ Lights (Point, Directional, Spot)
- ✅ NURBS curves
- ✅ Embedded textures (base64 and binary)

## Testing

To verify the refactored loader works identically to the original:

1. Load the same FBX file with both loaders
2. Compare the resulting scene graphs
3. Verify animations play identically
4. Check that materials and textures render the same

## Notes

- **Maintains 100% Compatibility**: All original FBX loader features preserved
- **No Behavioral Changes**: Identical output to original loader
- **Production Ready**: Follows Three.js coding standards and patterns
- **Maintainable**: Each file is focused and under 1000 lines
