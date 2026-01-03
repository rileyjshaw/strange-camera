import bigFace from './big-face';
import bodyCamo from './body-camo';
import channels from './channels';
import cutup from './cutup';
import faceCamo from './face-camo';
import sunday from './sunday';
import wiggleX from './wiggle x';
import wiggleY from './wiggle y';

const scenes = [bigFace, bodyCamo, channels, cutup, faceCamo, sunday, wiggleX, wiggleY].sort((a, b) =>
	a.name.localeCompare(b.name)
);

export const sceneHashToIndex = new Map(scenes.map((scene, index) => [scene.hash, index]));

export default scenes;
