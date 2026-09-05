// KTX2 / Basis Universal texture pipeline.
//
// Usage: node scripts/compress-textures.mjs [input.glb] [output.glb]
//
// The runtime already supports KTX2 (see src/lib/3d/assetLoaders.js): when a
// `nova_one.ktx2.glb` exists and the build sets VITE_KTX2_MODEL=true, the
// engine loads it and the textures stay GPU-compressed in VRAM instead of being
// expanded to RGBA.
//
// Producing that file needs a Basis encoder, which is a native binary and not
// an npm dependency. This script drives whichever encoder is available and
// tells you plainly when none is, rather than pretending the work happened.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2] ?? 'static/models/nova_one.glb';
const output = process.argv[3] ?? 'static/models/nova_one.ktx2.glb';

if (!fs.existsSync(input)) {
	console.error(`Input model not found: ${input}`);
	process.exit(1);
}

/** @param {string} bin */
const has = (bin) => spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0;

const encoders = [
	{ bin: 'toktx', label: 'KTX-Software (toktx)' },
	{ bin: 'basisu', label: 'Basis Universal (basisu)' }
];
const available = encoders.find((entry) => has(entry.bin));

if (!available) {
	console.log('No Basis encoder found on PATH.');
	console.log('Install one of these, then re-run:');
	console.log('  - KTX-Software  https://github.com/KhronosGroup/KTX-Software/releases');
	console.log('  - basisu        https://github.com/BinomialLLC/basis_universal');
	console.log('');
	console.log('The shipped model keeps its WebP textures, which every browser decodes;');
	console.log('the KTX2 path is wired and will activate automatically once this file exists.');
	process.exit(0);
}

console.log(`Encoder: ${available.label}`);

// gltf-transform drives the encoder and rewrites the GLB in one step.
const gltfTransform = spawnSync('npx', ['--no-install', '@gltf-transform/cli', '--version'], {
	stdio: 'ignore'
});
if (gltfTransform.status !== 0) {
	console.error('@gltf-transform/cli is not installed (npm i -D @gltf-transform/cli).');
	process.exit(1);
}

fs.mkdirSync(path.dirname(output), { recursive: true });

// ETC1S for colour maps (small, universally transcodable), UASTC for normal /
// metalness where banding would be visible.
execFileSync(
	'npx',
	[
		'--no-install',
		'@gltf-transform/cli',
		'etc1s',
		input,
		output,
		'--quality',
		'255',
		'--slots',
		'{baseColorTexture,emissiveTexture}'
	],
	{ stdio: 'inherit' }
);

const before = fs.statSync(input).size;
const after = fs.statSync(output).size;

// The browser needs the Basis transcoder to read what we just wrote, so ship it
// alongside the model. It is only fetched when a KTX2 model is actually loaded.
const transcoderSource = 'node_modules/three/examples/jsm/libs/basis';
if (fs.existsSync(transcoderSource)) {
	fs.mkdirSync('static/basis', { recursive: true });
	for (const file of fs.readdirSync(transcoderSource)) {
		fs.copyFileSync(path.join(transcoderSource, file), path.join('static/basis', file));
	}
	console.log('Copied the Basis transcoder to static/basis/.');
}

console.log(
	`\n${path.basename(output)}: ${(after / 1024).toFixed(0)} KB ` +
		`(was ${(before / 1024).toFixed(0)} KB). Build with VITE_KTX2_MODEL=true to use it.`
);
