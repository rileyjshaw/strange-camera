import bigFace from './big-face';
import bodyCamo from './body-camo';
import channels from './channels';
import cutup from './cutup';
import faceCamo from './face-camo';
import wiggleX from './wiggle x';
import wiggleY from './wiggle y';

const scenes = [bigFace, bodyCamo, channels, cutup, faceCamo, wiggleX, wiggleY].sort((a, b) =>
	a.name.localeCompare(b.name)
);

export default scenes;
