# FBXLoader.js Reference Guide

This document provides a line-by-line reference of the original FBXLoader.js file (4145 lines), describing what each 100-line section does.

---

## Lines 1-100: Imports and File Header
**Purpose:** Import dependencies and declare global variables

- **Lines 1-43:** Import 43 Three.js classes (AmbientLight, AnimationClip, Bone, BufferGeometry, Color, DirectionalLight, Euler, FileLoader, Float32BufferAttribute, Group, Line, LineBasicMaterial, Loader, Material, MathUtils, Matrix3, Matrix4, Mesh, MeshLambertMaterial, MeshPhongMaterial, NumberKeyframeTrack, Object3D, OrthographicCamera, PerspectiveCamera, PointLight, PropertyBinding, Quaternion, QuaternionKeyframeTrack, Skeleton, SkinnedMesh, SpotLight, SRGBColorSpace, TextureLoader, Uint16BufferAttribute, Vector3, Vector4, VectorKeyframeTrack, EquirectangularReflectionMapping, RepeatWrapping, ClampToEdgeWrapping, FrontSide, BackSide)
- **Lines 44-45:** Import fflate library for decompression
- **Line 46:** Import NURBSCurve from three.js examples
- **Lines 47-69:** JSDoc file header documenting FBX format requirements and references
- **Lines 70-72:** Declare global variables: fbxTree (parsed FBX data), connections (relationship map), sceneGraph (final scene)
- **Lines 73-80:** FBXLoader class declaration extending Loader, constructor accepting LoadingManager
- **Lines 81-100:** Start of load() method with URL, onLoad, onProgress, onError callbacks, FileLoader initialization

---

## Lines 101-200: FBXLoader Core Methods
**Purpose:** Complete load() method and implement parse() method

- **Lines 101-115:** End of load() method with error handling and manager.itemError() call
- **Lines 116-145:** parse() method: detects binary vs ASCII format using isFbxFormatBinary() and isFbxFormatASCII(), validates version (ASCII must be >= 7000), instantiates BinaryParser or TextParser
- **Lines 146-155:** Creates TextureLoader with path and cross-origin settings, instantiates FBXTreeParser
- **Lines 156-170:** FBXTreeParser class declaration with constructor storing textureLoader and manager
- **Lines 171-200:** parse() method orchestrating the entire parsing pipeline: parseConnections(), parseImages(), parseTextures(), parseMaterials(), parseDeformers(), parseGeometry(), parseModels(), parseScene()

---

## Lines 201-300: FBXTreeParser - Connections and Images
**Purpose:** Parse connection relationships and extract embedded images

- **Lines 201-235:** parseConnections() creates bidirectional Map of parent-child relationships from fbxTree.Connections.connections array. Each connection has fromID, toID, and relationship type. Builds connectionMap with parents[] and children[] arrays for efficient lookups
- **Lines 236-280:** parseImages() extracts embedded image data from fbxTree.Objects.Video nodes. Handles both ArrayBuffer (binary) and base64 string content types
- **Lines 281-300:** Calls parseImage() to convert content into usable format, creates blobs mapping for embedded images, returns images object mapping video IDs to filenames or data URLs

---

## Lines 301-400: Image Processing and Textures
**Purpose:** Convert image data and create texture map

- **Lines 301-345:** parseImage() processes videoNode.Content into usable image format. Determines MIME type from file extension (bmp, jpg, jpeg, png, tif, tga). Warns about TGA loader requirement. For string content returns data URL with base64. For binary content creates Blob URL via window.URL.createObjectURL()
- **Lines 346-385:** parseTextures() iterates fbxTree.Objects.Texture nodes, calls parseTexture() for each node, builds textureMap
- **Lines 386-400:** parseTexture() calls loadTexture() then sets texture properties: ID, name, wrapS/wrapT based on WrapModeU/WrapModeV (RepeatWrapping or ClampToEdgeWrapping), sets repeat.x/y from Scaling values, sets offset.x/y from Translation values

---

## Lines 401-500: Texture Loading and Materials
**Purpose:** Load textures and start parsing materials

- **Lines 401-450:** loadTexture() retrieves filename from images via connections. Handles blob: and data: URLs by clearing path. Checks file extension for special handling. TGA files use manager.getHandler('.tga') or create placeholder Texture if not found. PSD files create placeholder with warning (not supported). Other formats use textureLoader.load()
- **Lines 451-485:** Restores original textureLoader path. parseMaterials() creates materialMap from fbxTree.Objects.Material nodes
- **Lines 486-500:** Iterates materialNodes calling parseMaterial() for each. parseMaterial() extracts ID, name, and ShadingModel type. Handles case where ShadingModel is wrapped in object with .value property

---

## Lines 501-600: Material Creation and Parameters
**Purpose:** Create Three.js materials and extract material properties

- **Lines 501-530:** Ignores unused materials without connections. Calls parseParameters() to extract material properties. Creates appropriate material based on type: MeshPhongMaterial for 'phong', MeshLambertMaterial for 'lambert', defaults to MeshPhongMaterial. Sets material values and name
- **Lines 531-575:** parseParameters() method begins. Extracts BumpFactor for bumpScale. Handles Diffuse and DiffuseColor (with Blender exporter compatibility) to set color property, converts from sRGB to linear color space
- **Lines 576-600:** Extracts DisplacementFactor for displacementScale. Handles Emissive and EmissiveColor (with Blender compatibility) for emissive property. Extracts EmissiveFactor for emissiveIntensity, Opacity for opacity (sets transparent flag if < 1.0), ReflectionFactor for reflectivity, Shininess for shininess

---

## Lines 601-700: Material Texture Mapping
**Purpose:** Map textures to material properties based on relationship types

- **Lines 601-615:** Handles Specular and SpecularColor (with Blender compatibility) for specular property
- **Lines 616-695:** Iterates through child connections to map textures to material properties based on relationship type:
  - Bump → bumpMap
  - Maya|TEX_ao_map → aoMap
  - DiffuseColor/Maya|TEX_color_map → map (with SRGBColorSpace)
  - DisplacementColor → displacementMap
  - EmissiveColor → emissiveMap (with SRGBColorSpace)
  - NormalMap/Maya|TEX_normal_map → normalMap
  - ReflectionColor → envMap (with EquirectangularReflectionMapping and SRGBColorSpace)
  - SpecularColor → specularMap (with SRGBColorSpace)
  - TransparentColor/TransparencyFactor → alphaMap (sets transparent flag)
  - Warns about unsupported map types (AmbientColor, ShininessExponent, SpecularFactor, VectorDisplacementColor)
- **Lines 696-700:** Returns parameters object for material configuration

---

## Lines 701-800: Texture Handling and Deformers
**Purpose:** Handle layered textures and parse deformers (skinning/morph targets)

- **Lines 701-715:** getTexture() handles LayeredTexture by using first layer only (with warning). Returns texture from textureMap
- **Lines 716-760:** parseDeformers() creates skeletons and morphTargets objects. Iterates fbxTree.Objects.Deformer nodes. For 'Skin' attrType calls parseSkeleton(), stores skeleton with ID and geometryID. For 'BlendShape' attrType calls parseMorphTargets(), stores morph target with ID
- **Lines 761-800:** Warns if skeleton/morph target attached to more than one geometry. parseSkeleton() iterates relationships.children to find 'Cluster' nodes (bones). For each bone creates rawBone object with ID, indices, weights, transformLink matrix. Handles optional Indexes and Weights arrays

---

## Lines 801-900: Morph Targets and Scene Building
**Purpose:** Parse morph targets and build the main scene graph

- **Lines 801-820:** Completes parseSkeleton() by pushing rawBone to rawBones array, returns skeleton object with rawBones and empty bones array
- **Lines 821-855:** parseMorphTargets() iterates relationships.children to find 'BlendShapeChannel' nodes. For each creates rawMorphTarget with name, initialWeight (DeformPercent), id, fullWeights. Finds associated geometry ID via connections. Returns rawMorphTargets array
- **Lines 856-900:** parseScene() creates main sceneGraph Group. Calls parseModels() to create modelMap. Iterates modelMap to set LookAt properties. Processes parent connections to build scene hierarchy. Calls bindSkeleton() to attach skeletons to meshes. Calls createAmbientLight() to add ambient light if defined. Traverses scene to apply transformData matrices using generateTransform()

---

## Lines 901-1000: Scene Finalization and Model Parsing
**Purpose:** Complete scene setup and parse model nodes

- **Lines 901-920:** Applies transform matrices to nodes, updates world matrices. Creates AnimationParser to parse animations. If scene has single Group child, unwraps it. Assigns animations to sceneGraph
- **Lines 921-970:** parseModels() creates modelMap from fbxTree.Objects.Model nodes. For each model node, attempts to build skeleton via buildSkeleton(). If not skeleton, creates model based on attrType:
  - Camera → createCamera()
  - Light → createLight()
  - Mesh → createMesh()
  - NurbsCurve → createCurve()
  - LimbNode/Root → new Bone()
  - Null/default → new Group()
- **Lines 971-1000:** Sanitizes model name via PropertyBinding.sanitizeNodeName(). Stores originalName in userData. Assigns ID. Calls getTransformData() to extract transform properties. Adds model to modelMap. buildSkeleton() begins: searches for bones in skeletons matching parent relationships

---

## Lines 1001-1100: Skeleton Building and Camera Creation
**Purpose:** Build bone hierarchy and create cameras

- **Lines 1001-1025:** Completes buildSkeleton(): creates Bone, copies transformLink matrix to matrixWorld, sanitizes name, assigns ID, stores in skeleton.bones array. Handles cases where bone is shared between meshes (creates duplicate as child). Returns bone
- **Lines 1026-1065:** createCamera() searches relationships.children for NodeAttribute. If undefined, creates Object3D. If defined, extracts camera properties: CameraProjectionType (0=Perspective, 1=Orthographic), NearPlane/FarPlane for clipping (converted from mm to m), AspectWidth/AspectHeight for aspect ratio, FieldOfView for fov, FocalLength for focal length
- **Lines 1066-1100:** Creates PerspectiveCamera or OrthographicCamera based on type. Sets focal length if provided. Returns camera model

---

## Lines 1101-1200: Light Creation
**Purpose:** Create Three.js lights from FBX light nodes

- **Lines 1101-1115:** Completes createCamera() with warning for unknown camera types, returns Object3D as fallback
- **Lines 1116-1160:** createLight() searches relationships.children for NodeAttribute. If undefined, creates Object3D. If defined, extracts light properties: LightType (undefined/0=Point, 1=Directional, 2=Spot), Color (converted from sRGB to linear), Intensity (divided by 100). Handles CastLightOnObject flag (0=disabled, intensity set to 0)
- **Lines 1161-1200:** Extracts FarAttenuationEnd for distance (only if EnableFarAttenuation is enabled). Sets decay to 1. Creates PointLight for type 0, DirectionalLight for type 1. For type 2 (Spot): extracts InnerAngle for angle, OuterAngle for penumbra (with TODO note about incorrect conversion)

---

## Lines 1201-1300: Light Finalization and Mesh Creation
**Purpose:** Complete light creation and build mesh models

- **Lines 1201-1230:** Creates SpotLight with color, intensity, distance, angle, penumbra, decay. Warns for unknown light types, defaults to PointLight. Sets castShadow flag if CastShadows is enabled. Returns light model
- **Lines 1231-1270:** createMesh() initializes geometry, material, and materials array. Iterates relationships.children to find geometry in geometryMap and materials in materialMap. Handles single material vs multiple materials. Creates default MeshPhongMaterial if no materials found (color 0xcccccc)
- **Lines 1271-1305:** Enables vertexColors if geometry has color attribute. Creates SkinnedMesh if geometry.FBX_Deformer exists (calls normalizeSkinWeights()), otherwise creates regular Mesh. Returns mesh model

---

## Lines 1301-1400: Curve Creation and Transform Data
**Purpose:** Create NURBS curves and extract transform properties

- **Lines 1301-1330:** createCurve() finds geometry in geometryMap via relationships.children. Creates LineBasicMaterial with default properties (color 0x3300ff, linewidth 1). Returns Line object
- **Lines 1331-1365:** getTransformData() creates transformData object. Extracts InheritType, RotationOrder (converted via getEulerOrder, defaults to 'ZYX'), Lcl_Translation for translation, PreRotation, Lcl_Rotation, PostRotation for rotations
- **Lines 1366-1400:** Extracts Lcl_Scaling for scale, ScalingOffset, ScalingPivot, RotationOffset, RotationPivot for pivot/offset properties. Stores transformData in model.userData. setLookAtProperties() handles LookAtProperty relationships: extracts target position, sets model.target.position for DirectionalLight/SpotLight, calls model.lookAt() for cameras and other objects

---

## Lines 1401-1500: Skeleton Binding and Pose Parsing
**Purpose:** Bind skeletons to meshes and parse bind pose matrices

- **Lines 1401-1430:** bindSkeleton() calls parsePoseNodes() to get bind matrices. Iterates skeletons, finds parent geometries via connections. For each geometry, finds associated models in modelMap. Calls model.bind() with new Skeleton and bind matrix
- **Lines 1431-1465:** parsePoseNodes() creates bindMatrices object. Checks if 'Pose' exists in fbxTree.Objects. Iterates BindPoseNode to find 'BindPose' attrType with NbPoseNodes > 0. Extracts PoseNode entries (handles both Array and single object). Creates Matrix4 from poseNode.Matrix.a, stores in bindMatrices[poseNode.Node]
- **Lines 1466-1500:** createAmbientLight() checks GlobalSettings.AmbientColor. If color is not black (r,g,b not all 0), creates Color, converts from sRGB to linear, adds AmbientLight to sceneGraph with intensity 1. GeometryParser class declaration with constructor initializing negativeMaterialIndices flag

---

## Lines 1501-1600: Geometry Parsing
**Purpose:** Parse geometry nodes and create BufferGeometries

- **Lines 1501-1540:** GeometryParser.parse() creates geometryMap. Iterates fbxTree.Objects.Geometry nodes. For each node calls parseGeometry() with relationships, geoNode, and deformers. Stores result in geometryMap. Warns if negativeMaterialIndices is true (invalid material indices detected)
- **Lines 1541-1575:** parseGeometry() switches on geoNode.attrType: 'Mesh' calls parseMeshGeometry(), 'NurbsCurve' calls parseNurbsGeometry(). parseMeshGeometry() initializes skeletons and morphTargets. Maps parent relationships to modelNodes
- **Lines 1576-1600:** Returns early if no associated models. Finds skeleton in deformers via relationships.children. Finds morph targets in deformers. Gets first modelNode for transform data. Extracts RotationOrder, InheritType, GeometricTranslation, GeometricRotation, GeometricScaling. Calls generateTransform() and genGeometry()

---

## Lines 1601-1700: Buffer Generation and Attributes
**Purpose:** Generate BufferGeometry with all attributes

- **Lines 1601-1645:** genGeometry() creates BufferGeometry, sets name. Calls parseGeoNode() to extract geometry info. Calls genBuffers() to create buffer arrays. Creates position attribute from vertex buffer, applies preTransform matrix. Sets position attribute
- **Lines 1646-1690:** Sets color attribute if colors exist. For skinned geometry, sets skinIndex (Uint16) and skinWeight (Float32) attributes, stores FBX_Deformer reference. Sets normal attribute if normals exist (applies normalMatrix transformation). Sets UV attributes for each UV layer (uv, uv1, uv2, etc.)
- **Lines 1691-1700:** Handles material indices: if mappingType is not 'AllSame', converts material indices to rendering groups. Iterates materialIndex buffer, adds groups when material changes

---

## Lines 1701-1800: Geometry Node Parsing and Buffer Setup
**Purpose:** Extract geometry data and prepare buffer generation

- **Lines 1701-1740:** Completes material group handling: adds final group after loop, handles edge case of single material for entire geometry. Calls addMorphTargets(). parseGeoNode() creates geoInfo object. Extracts vertexPositions from Vertices.a, vertexIndices from PolygonVertexIndex.a. Parses LayerElementColor via parseVertexColors(), LayerElementMaterial via parseMaterialIndices(), LayerElementNormal via parseNormals()
- **Lines 1741-1770:** Parses LayerElementUV: iterates all UV layers, calls parseUVs() for each with UV data. Creates weightTable object. If skeleton exists, iterates skeleton.rawBones
- **Lines 1771-1800:** For each bone, iterates indices and weights. Populates weightTable[index] with {id, weight} objects for skinning. Returns geoInfo. genBuffers() creates buffers object with arrays for vertex, normal, colors, uvs, materialIndex, vertexWeights, weightsIndices. Initializes iteration variables

---

## Lines 1801-1900: Face Processing
**Purpose:** Process vertex indices and build face data

- **Lines 1801-1850:** Iterates geoInfo.vertexIndices. Handles negative indices marking end of face (uses XOR ^ -1 to get actual index). Pushes vertex position indices (x3 components). Extracts color data via getData(). For skeleton, retrieves weights and weightIndices from weightTable. Handles vertices with > 4 weights by keeping top 4 weights (with warning on first occurrence)
- **Lines 1851-1900:** Sorts weights by magnitude, keeps top 4. Pads weight arrays to length 4 with zeros. Pushes 4 weights and 4 weight indices to face arrays. Extracts normal data via getData(). Extracts material index via getData() (handles negative indices with warning). Extracts UV data for all UV layers via getData()

---

## Lines 1901-2000: Face Completion and Triangulation
**Purpose:** Complete face processing and triangulate polygons

- **Lines 1901-1945:** Increments faceLength. When endOfFace is true: warns if faceLength > 4 (non-triangle/quad faces not fully supported). Calls genFace() to triangulate and add to buffers. Increments polygonIndex. Resets faceLength and all face arrays. Returns buffers
- **Lines 1946-2000:** genFace() triangulates face by creating triangles from first vertex + consecutive pairs. For each triangle vertex (i from 2 to faceLength): pushes 3 vertices (indices 0, i-1, i) to vertex buffer. If skeleton exists, pushes corresponding vertex weights and weight indices (3 vertices × 4 weights = 12 values)

---

## Lines 2001-2100: Face Buffer Population
**Purpose:** Populate all buffer arrays for each triangle

- **Lines 2001-2045:** Continues genFace(): pushes weight indices to weightsIndices buffer (same pattern as vertexWeights). If colors exist, pushes 3 vertices worth of color data to colors buffer. If material exists and mappingType is not 'AllSame', pushes material index 3 times (one per vertex)
- **Lines 2046-2085:** If normals exist, pushes 3 vertices worth of normal data to normal buffer. If UVs exist, iterates all UV layers and pushes 2 components per vertex (6 total values per triangle) to uvs buffers
- **Lines 2086-2100:** addMorphTargets() checks if morphTargets array is empty, returns early if so. Sets parentGeo.morphTargetsRelative = true. Initializes parentGeo.morphAttributes.position array. Iterates morphTargets, for each rawTarget calls genMorphGeometry()

---

## Lines 2101-2200: Morph Geometry and Normal Parsing
**Purpose:** Generate morph target geometries and parse normals

- **Lines 2101-2150:** genMorphGeometry() retrieves parentGeoNode.PolygonVertexIndex, morphGeoNode.Vertices (sparse), and morphGeoNode.Indexes. Creates morphPositions Float32Array with same length as parent geometry. Iterates indices, copies sparse positions to full array at correct positions (× 3 for x,y,z components)
- **Lines 2151-2190:** Creates morphGeoInfo with vertexIndices and vertexPositions. Calls genBuffers() to triangulate morph geometry. Creates Float32BufferAttribute from morphBuffers.vertex. Sets name from parameter or morphGeoNode.attrName. Applies preTransform matrix. Pushes to parentGeo.morphAttributes.position
- **Lines 2191-2200:** parseNormals() extracts MappingInformationType, ReferenceInformationType, Normals.a buffer. If referenceType is 'IndexToDirect', extracts NormalIndex.a or NormalsIndex.a as indexBuffer

---

## Lines 2201-2300: UV, Color, and Material Parsing
**Purpose:** Parse UVs, vertex colors, and material indices

- **Lines 2201-2235:** Completes parseNormals(): returns object with dataSize: 3, buffer, indices, mappingType, referenceType. parseUVs() extracts MappingInformationType, ReferenceInformationType, UV.a buffer. If referenceType is 'IndexToDirect', extracts UVIndex.a as indexBuffer. Returns object with dataSize: 2, buffer, indices, mappingType, referenceType
- **Lines 2236-2270:** parseVertexColors() extracts MappingInformationType, ReferenceInformationType, Colors.a buffer. If referenceType is 'IndexToDirect', extracts ColorIndex.a as indexBuffer. Iterates buffer in steps of 4, converts each color from sRGB to linear using Color.fromArray().convertSRGBToLinear().toArray()
- **Lines 2271-2300:** Returns object with dataSize: 4, buffer, indices, mappingType, referenceType. parseMaterialIndices() extracts MappingInformationType, ReferenceInformationType. If mappingType is 'NoMappingInformation', returns default object with dataSize: 1, buffer: [0], indices: [0], mappingType: 'AllSame'

---

## Lines 2301-2400: Material Indices and NURBS Geometry
**Purpose:** Complete material index parsing and handle NURBS curves

- **Lines 2301-2340:** Continues parseMaterialIndices(): extracts Materials.a as materialIndexBuffer. Creates materialIndices array with sequential integers [0, 1, 2, ...] matching buffer length (for conforming with other data functions). Returns object with dataSize: 1, buffer: materialIndexBuffer, indices: materialIndices, mappingType, referenceType
- **Lines 2341-2380:** parseNurbsGeometry() parses Order (integer). Validates order (returns empty BufferGeometry if NaN). Calculates degree = order - 1. Extracts KnotVector.a, Points.a. Iterates Points in steps of 4, creates Vector4 controlPoints array
- **Lines 2381-2400:** Handles geoNode.Form: if 'Closed', appends first control point to end. If 'Periodic', sets startKnot = degree, endKnot = knots.length - 1 - startKnot, appends first degree control points to end. Creates NURBSCurve, calls getPoints() with controlPoints.length × 12 samples. Returns BufferGeometry.setFromPoints()

---

## Lines 2401-2500: Animation Parsing Setup
**Purpose:** Parse animation data and create animation clips

- **Lines 2401-2440:** AnimationParser class declaration. parse() creates animationClips array. Calls parseClips() to get rawClips. If rawClips is defined, iterates keys and calls addClip() for each rawClip. Returns animationClips array
- **Lines 2441-2475:** parseClips() checks if fbxTree.Objects.AnimationCurve exists (returns undefined if not). Calls parseAnimationCurveNodes(), parseAnimationCurves(), parseAnimationLayers(), parseAnimStacks(). Returns rawClips
- **Lines 2476-2500:** parseAnimationCurveNodes() gets rawCurveNodes from fbxTree.Objects.AnimationCurveNode. Creates curveNodesMap. Iterates rawCurveNodes. If attrName matches /S|R|T|DeformPercent/, creates curveNode object with id, attr (attrName), curves: {}. Stores in curveNodesMap

---

## Lines 2501-2600: Animation Curves and Layers
**Purpose:** Parse animation curves and connect to curve nodes

- **Lines 2501-2550:** parseAnimationCurves() gets rawCurves from fbxTree.Objects.AnimationCurve. Iterates rawCurves, creates animationCurve with id, times (from KeyTime.a converted via convertFBXTimeToSeconds), values (from KeyValueFloat.a). Gets relationships for curve. If relationships exist, gets parent animationCurveID and relationship string
- **Lines 2551-2600:** Based on relationship string, assigns curve to appropriate axis in curveNodesMap: /X/ → curves['x'], /Y/ → curves['y'], /Z/ → curves['z'], /DeformPercent/ → curves['morph']. parseAnimationLayers() gets rawLayers from fbxTree.Objects.AnimationLayer. Creates layersMap. Iterates rawLayers, creates layerCurveNodes array. Gets connection for layer, iterates children

---

## Lines 2601-2700: Animation Layer Processing
**Purpose:** Build animation layer structure with curve nodes

- **Lines 2601-2650:** For each child, if curveNode exists in curveNodesMap: checks if curves are defined for at least one axis (x, y, or z). If so, gets modelID from parent connections (filtered by relationship !== undefined). Retrieves rawModel from fbxTree.Objects.Model. Creates node object with modelName (sanitized), ID, initialPosition: [0,0,0], initialRotation: [0,0,0], initialScale: [1,1,1]
- **Lines 2651-2700:** Traverses sceneGraph to find child with matching ID, stores transform matrix and eulerOrder. Sets default transform to identity Matrix4 if not found. Handles PreRotation and PostRotation from rawModel. Stores node in layerCurveNodes[i]. Assigns curveNode to node[curveNode.attr]. Handles morph curves: gets deformerID, morpherID, geoID, modelID via connections chain. Creates node with modelName and morphName. Stores in layerCurveNodes[i]

---

## Lines 2701-2800: Animation Stacks and Track Generation
**Purpose:** Parse animation stacks and generate keyframe tracks

- **Lines 2701-2740:** Completes parseAnimationLayers(): assigns curveNode to layerCurveNodes[i][curveNode.attr]. Stores layerCurveNodes in layersMap. parseAnimStacks() gets rawStacks from fbxTree.Objects.AnimationStack. Creates rawClips object. Iterates rawStacks, gets children connections. Warns if children.length > 1 (multiple layers not supported)
- **Lines 2741-2785:** Gets layer from layersMap using children[0].ID. Creates rawClips[nodeID] with name (from attrName) and layer. Returns rawClips. addClip() initializes tracks array. Iterates rawClip.layer, calls generateTracks() for each rawTracks, concatenates results to tracks array. Creates AnimationClip with name and tracks (duration -1 for auto-calculation)
- **Lines 2786-2800:** generateTracks() initializes tracks array, initialPosition (Vector3), initialRotation (Quaternion), initialScale (Vector3). If rawTracks.transform exists, decomposes into position, rotation, scale. Converts initialRotation to Euler with eulerOrder

---

## Lines 2801-2900: Track Generation
**Purpose:** Generate position, rotation, scale, and morph tracks

- **Lines 2801-2840:** Converts initialPosition to array, initialRotation to Euler array, initialScale to array. If rawTracks.T exists and has curves, calls generateVectorTrack() with 'position' type, pushes to tracks. If rawTracks.R exists and has curves, calls generateRotationTrack() with preRotation, postRotation, eulerOrder, pushes to tracks
- **Lines 2841-2880:** If rawTracks.S exists and has curves, calls generateVectorTrack() with 'scale' type, pushes to tracks. If rawTracks.DeformPercent exists, calls generateMorphTrack(), pushes to tracks. Returns tracks. generateVectorTrack() calls getTimesForAllAxes() to merge times, getKeyframeTrackValues() to build values array. Creates VectorKeyframeTrack with name: modelName + '.' + type
- **Lines 2881-2900:** generateRotationTrack() begins: if curves.x exists, calls interpolateRotations() and converts values to radians via degToRad. Same for curves.y and curves.z

---

## Lines 2901-3000: Rotation Track Processing
**Purpose:** Process rotation tracks and morph tracks

- **Lines 2901-2945:** Calls getTimesForAllAxes() to merge times, getKeyframeTrackValues() to build values array. If preRotation exists: converts to radians, appends eulerOrder, creates Euler, converts to Quaternion. If postRotation exists: converts to radians, appends eulerOrder, creates Euler, converts to Quaternion, inverts
- **Lines 2946-2990:** Creates quaternion and euler objects. Iterates values in steps of 3, creates Euler from [x,y,z,eulerOrder], converts to Quaternion. If preRotation exists, premultiplies. If postRotation exists, multiplies. Stores quaternion in quaternionValues array (4 components per entry). Creates QuaternionKeyframeTrack with name: modelName + '.quaternion'
- **Lines 2991-3000:** generateMorphTrack() gets curves from rawTracks.DeformPercent.curves.morph. Divides values by 100 (percent to decimal). Gets morphNum from sceneGraph object's morphTargetDictionary using morphName. Creates NumberKeyframeTrack with name: modelName + '.morphTargetInfluences[' + morphNum + ']'

---

## Lines 3001-3100: Time Merging and Text Parser
**Purpose:** Merge animation times and begin text parser

- **Lines 3001-3045:** getTimesForAllAxes() creates empty times array. Concatenates curves.x.times, curves.y.times, curves.z.times (if they exist). Sorts times array. Removes duplicates by iterating and comparing consecutive values. Returns deduplicated times array
- **Lines 3046-3090:** getKeyframeTrackValues() initializes prevValue from initialValue, values array, and indices (xIndex, yIndex, zIndex) to -1. Iterates times array. For each time, finds index in curves.x.times, curves.y.times, curves.z.times. If index found (≠ -1), uses curve value and updates prevValue. If not found, uses previous value from prevValue
- **Lines 3091-3100:** Returns values array. interpolateRotations() handles large rotation spans (≥ 180°). For each consecutive pair of values, calculates span. If absoluteSpan ≥ 180, calculates numSubIntervals, step, and interval

---

## Lines 3101-3200: Rotation Interpolation and Text Parser Methods
**Purpose:** Complete rotation interpolation and implement text parser

- **Lines 3101-3145:** Continues interpolateRotations(): generates interpolated times and values between large rotation jumps. Calls inject() to insert interpolated arrays at index i in curves.times and curves.values. TextParser class declaration with getPrevNode(), getCurrentNode(), getCurrentProp() accessors
- **Lines 3146-3185:** pushStack(), popStack(), setCurrentProp() methods for managing parsing state. parse() initializes currentIndent, allNodes (FBXTree), nodeStack, currentProp, currentPropName. Splits text by newlines. Iterates each line
- **Lines 3186-3200:** Matches comment lines (^\s\t*;), empty lines (^\s\t*$), beginning lines (^\t{n}(\w+):(.*){), property lines (^\t{n}(\w+):[\s\t\r\n](.*)), end lines (^\t{n-1}}). If matchComment or matchEmpty, skips. If matchBeginning, calls parseNodeBegin()

---

## Lines 3201-3300: Text Parser Node Handling
**Purpose:** Parse text format nodes and properties

- **Lines 3201-3245:** If matchProperty, calls parseNodeProperty(). If matchEnd, calls popStack(). If line matches /^[^\s\t}]/, calls parseNodePropertyContinued() (handles multi-line arrays). parseNodeBegin() extracts nodeName (trims, removes quotes). Splits property[2] by commas to get nodeAttrs (trims, removes quotes). Creates node object, calls parseNodeAttr()
- **Lines 3246-3285:** Gets currentNode. If currentIndent === 0 (top level), calls allNodes.add(). If subnode: handles existing nodeName in currentNode. Special case for 'PoseNode' pushes to array. Handles id-based nodes. Handles 'Properties70' specially. If attrs.id is number, creates nested object. Otherwise assigns node directly
- **Lines 3286-3300:** Assigns attrs.id to node.id if number. Assigns attrs.name to node.attrName. Assigns attrs.type to node.attrType. Calls pushStack(). parseNodeAttr() parses attrs[0] as id (tries parseInt, keeps string if NaN). Extracts name from attrs[1] (removes namespace), type from attrs[2]

---

## Lines 3301-3400: Text Parser Properties
**Purpose:** Parse node properties and special properties

- **Lines 3301-3345:** Returns {id, name, type}. parseNodeProperty() extracts propName and propValue (removes quotes, trims). Special case for 'Content' property with value ',' (base64 image data on next line): uses contentLine (removes quotes and trailing comma). Gets currentNode and parentName
- **Lines 3346-3385:** If parentName is 'Properties70', calls parseNodeSpecialProperty() and returns. If propName is 'C' (Connections): splits propValue by commas, extracts from (connProps[0]) and to (connProps[1]) as integers. Gets rest of connection properties. Sets propName to 'connections', propValue to [from, to]. Appends rest to propValue. Initializes currentNode[propName] as array if undefined
- **Lines 3386-3400:** If propName is 'Node', sets currentNode.id to propValue. If propName already exists in currentNode and is Array, pushes propValue. Otherwise assigns propValue (special handling for 'a' property). Calls setCurrentProp(). If propName is 'a' and doesn't end with comma, calls parseNumberArray() to convert string to array

---

## Lines 3401-3500: Special Properties and Binary Parser
**Purpose:** Handle special properties and begin binary parser

- **Lines 3401-3445:** parseNodePropertyContinued() appends line to currentNode.a. If line doesn't end with comma, calls parseNumberArray() to convert accumulated string to array. parseNodeSpecialProperty() parses "Property70" format: splits propValue by '",'. Maps to remove quotes and replace spaces with underscores. Extracts innerPropName, innerPropType1, innerPropType2, innerPropFlag, innerPropValue
- **Lines 3446-3485:** Switches on innerPropType1 to cast values: int/enum/bool/ULongLong/double/Number/FieldOfView → parseFloat(). Color/ColorRGB/Vector3D/Lcl_* → parseNumberArray(). Assigns to getPrevNode()[innerPropName] with type, type2, flag, value. Calls setCurrentProp()
- **Lines 3486-3500:** BinaryParser class declaration. parse() creates BinaryReader, skips 23 magic bytes. Gets version (Uint32). Throws error if version < 6400. Creates allNodes (FBXTree). While not endOfContent(), calls parseNode() and adds to allNodes if not null

---

## Lines 3501-3600: Binary Parser Property Parsing
**Purpose:** Parse binary format properties

- **Lines 3501-3545:** Returns allNodes. endOfContent() checks if reader has reached end: calculates footer size (160 bytes + 16-byte alignment padding). Uses 16-byte aligned offset comparison. parseNode() creates node object. Reads endOffset, numProperties (Uint32 for version < 7500, Uint64 for version ≥ 7500). Reads propertyListLen (unused). Reads nameLen (Uint8) and name string
- **Lines 3546-3590:** Returns null if endOffset is 0 (NULL-record). Creates propertyList array. For each property, calls parseProperty(). Extracts id, attrName, attrType from first 3 propertyList elements. Determines if node is singleProperty (numProperties === 1 && reader at endOffset). While offset < endOffset, calls parseNode() recursively and parseSubNode()
- **Lines 3591-3600:** Assigns propertyList, id, attrName, attrType, name to node. Returns node. parseSubNode() handles special cases: if subNode.singleProperty, extracts value from propertyList[0]. If Array, assigns to node[subNode.name] with subNode.a = value. Otherwise assigns value directly

---

## Lines 3601-3700: Binary Parser Subnode Handling
**Purpose:** Handle subnodes and property types

- **Lines 3601-3645:** If name is 'Connections' and subNode.name is 'C': creates array from propertyList (skipping first element). Initializes node.connections array if undefined. Pushes array to connections. If subNode.name is 'Properties70': copies all keys from subNode to node. If name is 'Properties70' and subNode.name is 'P': extracts innerPropName, innerPropType1, innerPropType2, innerPropFlag
- **Lines 3646-3685:** Replaces 'Lcl ' with 'Lcl_' in innerPropName and innerPropType1. If innerPropType1 is Color/ColorRGB/Vector/Vector3D/Lcl_*, creates innerPropValue as array [propertyList[4], propertyList[5], propertyList[6]]. Otherwise uses propertyList[4]. Assigns to node[innerPropName] with type, type2, flag, value
- **Lines 3686-3700:** If node[subNode.name] is undefined: if subNode.id is number, creates nested object. Otherwise assigns subNode. If node[subNode.name] exists: special case for 'PoseNode' converts to array or pushes. Otherwise assigns to node[subNode.name][subNode.id]. parseProperty() reads type character (1 byte)

---

## Lines 3701-3800: Binary Property Types
**Purpose:** Parse binary property types

- **Lines 3701-3745:** Switches on type character:
  - 'C' → getBoolean()
  - 'D' → getFloat64()
  - 'F' → getFloat32()
  - 'I' → getInt32()
  - 'L' → getInt64()
  - 'R' → reads length (Uint32), getArrayBuffer(length)
  - 'S' → reads length (Uint32), getString(length)
  - 'Y' → getInt16()
  - 'b', 'c', 'd', 'f', 'i', 'l' → array types (continues below)
- **Lines 3746-3785:** For array types: reads arrayLength (Uint32), encoding (Uint32, 0=uncompressed, 1=compressed), compressedLength (Uint32). If encoding === 0: switches on type to call appropriate getArray method (getBooleanArray, getFloat64Array, getFloat32Array, getInt32Array, getInt64Array)
- **Lines 3786-3800:** If encoding === 1 (compressed): calls fflate.unzlibSync() to decompress ArrayBuffer. Creates new BinaryReader with decompressed data. Switches on type to call appropriate getArray method from reader2. Throws error for unknown property type

---

## Lines 3801-3900: Binary Reader Implementation
**Purpose:** Implement binary data reader

- **Lines 3801-3845:** BinaryReader class constructor: creates DataView, initializes offset to 0, sets littleEndian (defaults to true), creates TextDecoder. getOffset(), size(), skip() methods. getBoolean(): reads Uint8, checks LSB (& 1 === 1). getBooleanArray(): loops to create array of booleans. getUint8(): reads Uint8, increments offset
- **Lines 3846-3885:** getInt16(): reads Int16, increments offset by 2. getInt32(): reads Int32, increments offset by 4. getInt32Array(): loops to create array of Int32. getUint32(): reads Uint32, increments offset by 4. getInt64(): reads low and high Uint32 (order depends on littleEndian)
- **Lines 3886-3900:** Calculates negative values using bitwise NOT and addition. Returns high * 0x100000000 + low. getInt64Array(): loops to create array of Int64

---

## Lines 3901-4000: Binary Reader Methods
**Purpose:** Complete binary reader implementation

- **Lines 3901-3945:** getUint64(): reads low and high Uint32 (order depends on littleEndian), returns high * 0x100000000 + low. getFloat32(): reads Float32, increments offset by 4. getFloat32Array(): loops to create array of Float32. getFloat64(): reads Float64, increments offset by 8. getFloat64Array(): loops to create array of Float64
- **Lines 3946-3985:** getArrayBuffer(): slices dv.buffer from offset to offset + size, increments offset. getString(): reads start offset, creates Uint8Array view of size bytes. Skips size bytes. Finds null byte (if exists, trims array to null byte). Decodes array using TextDecoder, returns string
- **Lines 3986-4000:** FBXTree class declaration with add() method. Utility functions section begins. isFbxFormatBinary(): checks if buffer starts with 'Kaydara FBX Binary  \0' (23 bytes) using convertArrayBufferToString()

---

## Lines 4001-4100: Utility Functions
**Purpose:** Format detection and helper functions

- **Lines 4001-4045:** isFbxFormatASCII(): checks if text does NOT start with 'Kaydara\FBX\Binary\\' by reading characters and comparing to CORRECT array. Returns true if ASCII format. getFbxVersion(): uses regex /FBXVersion: (\d+)/ to extract version number from text. Throws error if version not found. convertFBXTimeToSeconds(): divides time by 46186158000 to convert FBX ticks to seconds
- **Lines 4046-4085:** Declares dataArray for getData(). getData(): extracts data from FBX array based on indexing type. Switches on mappingType: 'ByPolygonVertex' uses polygonVertexIndex, 'ByPolygon' uses polygonIndex, 'ByVertice' uses vertexIndex, 'AllSame' uses infoObject.indices[0]. If referenceType is 'IndexToDirect', gets index from infoObject.indices[index]. Calculates from/to range, calls slice() to extract data
- **Lines 4086-4100:** Declares tempEuler (Euler) and tempVec (Vector3) for generateTransform(). generateTransform(): creates 11 Matrix4 objects for transform chain (lTranslationM, lPreRotationM, lRotationM, lPostRotationM, lScalingM, lScalingPivotM, lScalingOffsetM, lRotationOffsetM, lRotationPivotM, lParentGX, lParentLX, lGlobalT). Gets inheritType (defaults to 0)

---

## Lines 4101-4145: Final Utility Functions
**Purpose:** Complete transformation and helper functions

- **Lines 4101-4145:** Completes generateTransform(): applies transformData to matrices (translation, preRotation, rotation, postRotation, scale). Handles scalingOffset, scalingPivot, rotationOffset, rotationPivot. Handles parentMatrix and parentMatrixWorld. Calculates lLRM (local rotation). Extracts parent rotation, parent transform. Calculates global rotation/scale based on inheritType (0, 1, or 2). Inverts pivot matrices. Calculates final transform chain: lTranslationM × lRotationOffsetM × lRotationPivotM × lPreRotationM × lRotationM × lPostRotationM × lRotationPivotM_inv × lScalingOffsetM × lScalingPivotM × lScalingM × lScalingPivotM_inv. Calculates global transform, premultiplies by parent inverse. Returns lTransform. getEulerOrder(): converts FBX extrinsic to Three.js intrinsic order (0='ZYX', 1='YZX', 2='XZY', 3='ZXY', 4='YXZ', 5='XYZ'). Warns for Spherical XYZ (6). parseNumberArray(): splits string by commas, maps to parseFloat(). convertArrayBufferToString(): uses TextDecoder to decode Uint8Array from buffer. append(): appends array b to array a. slice(): copies elements from array b to array a within range. inject(): inserts array a2 into array a1 at index. Exports FBXLoader.

---

## Summary

The FBXLoader.js file is organized into distinct sections:

1. **Lines 1-200:** Imports, file header, FBXLoader class with load() and parse() methods, FBXTreeParser class declaration
2. **Lines 201-700:** Connection parsing, image extraction, texture loading, material creation and parameter extraction
3. **Lines 701-1500:** Deformer parsing (skinning/morphs), scene building, model creation (cameras, lights, meshes, curves), transform handling, skeleton binding
4. **Lines 1501-2400:** GeometryParser class: mesh geometry parsing, buffer generation, attribute extraction, morph targets, NURBS curves
5. **Lines 2401-3100:** AnimationParser class: animation clips, curves, layers, stacks, track generation, rotation interpolation
6. **Lines 3101-3500:** TextParser class: ASCII format parsing with node and property handling
7. **Lines 3501-4000:** BinaryParser class: binary format parsing, BinaryReader implementation with data type methods
8. **Lines 4001-4145:** Utility functions: format detection, time conversion, data extraction, transform generation, helper functions

---

**Total Lines:** 4145  
**Total Sections:** 42 (41 complete 100-line sections + 1 final 45-line section)

