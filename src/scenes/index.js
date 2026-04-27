import bigFace from './big-face';
import blurryface from './blurryface';
import bodyCamo from './body-camo';
import bodyDouble from './body-double';
import channels from './channels';
// import colorPop from './color-pop';
import cutGlass from './cut-glass';
import cutup from './cutup';
import dither from './dither';
import faceCamo from './face-camo';
import fill from './fill';
import fishbowl from './fishbowl';
import kaleidoscope from './kaleidoscope';
import lightTrails from './light-trails';
import meshSensor from './mesh-sensor';
import pixelface from './pixelface';
import salon from './salon';
import slitScan from './slit-scan';
import slow from './slow';
import sorted from './sorted';
import sunday from './sunday';
import wiggleX from './wiggle x';
import wiggleY from './wiggle y';
import wireface from './wireface';

const scenes = [
	bigFace,
	blurryface,
	bodyCamo,
	bodyDouble,
	channels,
	// colorPop,
	cutGlass,
	cutup,
	dither,
	faceCamo,
	fill,
	fishbowl,
	kaleidoscope,
	lightTrails,
	meshSensor,
	pixelface,
	salon,
	slitScan,
	slow,
	sorted,
	sunday,
	wiggleX,
	wiggleY,
	wireface,
].sort((a, b) => a.name.localeCompare(b.name));

export const sceneHashToIndex = new Map(scenes.map((scene, index) => [scene.hash, index]));

export default scenes;
