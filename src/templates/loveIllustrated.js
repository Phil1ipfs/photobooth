// Original illustrated Love frames, including a theater ticket inspired by the supplied reference.
import frame0 from '../assets/love-strips/theater-of-us.webp';
import preview0 from '../assets/love-strips/theater-of-us-preview.webp';
import frame1 from '../assets/love-strips/sealed-with-love.webp';
import preview1 from '../assets/love-strips/sealed-with-love-preview.webp';
import frame2 from '../assets/love-strips/cherry-kisses.webp';
import preview2 from '../assets/love-strips/cherry-kisses-preview.webp';
import frame3 from '../assets/love-strips/swan-serenade.webp';
import preview3 from '../assets/love-strips/swan-serenade-preview.webp';
import frame4 from '../assets/love-strips/cupid-social-club.webp';
import preview4 from '../assets/love-strips/cupid-social-club-preview.webp';
import frame5 from '../assets/love-strips/moonlit-promise.webp';
import preview5 from '../assets/love-strips/moonlit-promise-preview.webp';
import frame6 from '../assets/love-strips/ribbon-vows.webp';
import preview6 from '../assets/love-strips/ribbon-vows-preview.webp';
import frame7 from '../assets/love-strips/rose-garden-date.webp';
import preview7 from '../assets/love-strips/rose-garden-date-preview.webp';
import frame8 from '../assets/love-strips/mixtape-for-two.webp';
import preview8 from '../assets/love-strips/mixtape-for-two-preview.webp';
import frame9 from '../assets/love-strips/love-airmail.webp';
import preview9 from '../assets/love-strips/love-airmail-preview.webp';

export const ILLUSTRATED_LOVE_TEMPLATES = [
  {
    id: 'theater-of-us',
    name: 'Theater of Us',
    description: 'A burgundy-and-cream theater ticket with notched edges and admission details.',
    categories: ["love","retro","editorial"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#f6ebdb' },
    layout: {"padX":35,"top":244,"gap":28,"bottom":269,"slotAspect":1.7344173441734418},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#dfb2b2","#9b4352"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame0, previewSrc: preview0, width: 724, height: 2172, windows: [{"x":42,"y":295,"w":640,"h":369},{"x":42,"y":695,"w":640,"h":363},{"x":42,"y":1090,"w":640,"h":362},{"x":42,"y":1484,"w":640,"h":364}], photosOnTop: true },
  },
  {
    id: 'sealed-with-love',
    name: 'Sealed With Love',
    description: 'Cream love-letter stationery with burgundy wax seals and pressed flowers.',
    categories: ["love","aesthetic","retro"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#f1e6d7' },
    layout: {"padX":39,"top":122,"gap":63,"bottom":280,"slotAspect":1.617948717948718},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#e8b9c1","#a96178"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame1, previewSrc: preview1, width: 724, height: 2172, windows: [{"x":47,"y":147,"w":631,"h":390},{"x":47,"y":613,"w":631,"h":356},{"x":47,"y":1044,"w":631,"h":356},{"x":47,"y":1476,"w":631,"h":358}], photosOnTop: true },
  },
  {
    id: 'cherry-kisses',
    name: 'Cherry Kisses',
    description: 'Blush gingham, cherry pairs, tiny hearts and a romantic red bow.',
    categories: ["love","cute","retro"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#f6d5d8' },
    layout: {"padX":43,"top":120,"gap":67,"bottom":267,"slotAspect":1.627296587926509},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#efb5bf","#bc647d"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame2, previewSrc: preview2, width: 724, height: 2172, windows: [{"x":52,"y":145,"w":620,"h":381},{"x":53,"y":607,"w":619,"h":378},{"x":53,"y":1070,"w":619,"h":357},{"x":53,"y":1504,"w":619,"h":346}], photosOnTop: false },
  },
  {
    id: 'swan-serenade',
    name: 'Swan Serenade',
    description: 'An ivory and powder-blue keepsake with swans, gold stars and floral details.',
    categories: ["love","aesthetic"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#edf1ed' },
    layout: {"padX":55,"top":126,"gap":36,"bottom":363,"slotAspect":1.5538057742782152},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#c7d8df","#879fb3"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame3, previewSrc: preview3, width: 724, height: 2172, windows: [{"x":66,"y":152,"w":592,"h":381},{"x":66,"y":576,"w":592,"h":354},{"x":66,"y":972,"w":592,"h":359},{"x":66,"y":1373,"w":591,"h":361}], photosOnTop: false },
  },
  {
    id: 'cupid-social-club',
    name: 'Cupid Social Club',
    description: 'A pink Valentine club strip with cupid arrows, ribbon bows and winged hearts.',
    categories: ["love","cute"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#f6d6df' },
    layout: {"padX":44,"top":114,"gap":60,"bottom":298,"slotAspect":1.6568364611260054},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#eeb2ca","#b05a7e"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame4, previewSrc: preview4, width: 724, height: 2172, windows: [{"x":53,"y":137,"w":618,"h":373},{"x":53,"y":582,"w":618,"h":373},{"x":53,"y":1028,"w":618,"h":372},{"x":53,"y":1472,"w":618,"h":340}], photosOnTop: false },
  },
  {
    id: 'moonlit-promise',
    name: 'Moonlit Promise',
    description: 'Midnight-blue celestial romance with gold constellations and a rose moon.',
    categories: ["love","aesthetic"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#172438' },
    layout: {"padX":56,"top":139,"gap":47,"bottom":408,"slotAspect":1.6526610644257702},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#aeb4d2","#657392"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame5, previewSrc: preview5, width: 724, height: 2172, windows: [{"x":67,"y":168,"w":590,"h":357},{"x":67,"y":582,"w":590,"h":326},{"x":67,"y":966,"w":590,"h":329},{"x":67,"y":1353,"w":590,"h":327}], photosOnTop: false },
  },
  {
    id: 'ribbon-vows',
    name: 'Ribbon Vows',
    description: 'Champagne stationery with blush bows, pearl dots and delicate lace.',
    categories: ["love","aesthetic","minimal"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#f3e9df' },
    layout: {"padX":45,"top":82,"gap":39,"bottom":302,"slotAspect":1.5728900255754477},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#e6cbd0","#b791a1"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame6, previewSrc: preview6, width: 724, height: 2172, windows: [{"x":54,"y":99,"w":615,"h":391},{"x":54,"y":537,"w":615,"h":391},{"x":54,"y":976,"w":615,"h":391},{"x":54,"y":1416,"w":615,"h":391}], photosOnTop: false },
  },
  {
    id: 'rose-garden-date',
    name: 'Rose Garden Date',
    description: 'A sage-and-rose garden keepsake with floral borders and an arbor footer.',
    categories: ["love","aesthetic","cute"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#edf0df' },
    layout: {"padX":54,"top":94,"gap":32,"bottom":423,"slotAspect":1.6545961002785516},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#cbd8bd","#8b9d80"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame7, previewSrc: preview7, width: 724, height: 2172, windows: [{"x":65,"y":114,"w":594,"h":359},{"x":65,"y":512,"w":594,"h":356},{"x":65,"y":907,"w":594,"h":357},{"x":65,"y":1302,"w":594,"h":359}], photosOnTop: false },
  },
  {
    id: 'mixtape-for-two',
    name: 'Mixtape for Two',
    description: 'A nostalgic cream and coral cassette strip with heart-shaped tape ribbons.',
    categories: ["love","retro","cute"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#f4dec7' },
    layout: {"padX":47,"top":90,"gap":69,"bottom":346,"slotAspect":1.6991643454038998},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#e4b49f","#b5796e"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame8, previewSrc: preview8, width: 724, height: 2172, windows: [{"x":57,"y":109,"w":610,"h":359},{"x":57,"y":551,"w":610,"h":361},{"x":57,"y":995,"w":610,"h":341},{"x":57,"y":1418,"w":610,"h":337}], photosOnTop: false },
  },
  {
    id: 'love-airmail',
    name: 'Love Airmail',
    description: 'A romantic cream airmail postcard with heart stamps and a tiny paper plane.',
    categories: ["love","retro","aesthetic"],
    featuredCategories: ['love'],
    layoutId: 'strip-1x4',
    background: { type: 'solid', color: '#f1e9da' },
    layout: {"padX":34,"top":123,"gap":59,"bottom":278,"slotAspect":1.5812807881773399},
    frame: { shape: 'rect' },
    placeholder: { bg: ["#d2c6c0","#998c9a"], figure: 'rgba(255,255,255,0.78)' },
    artwork: { src: frame9, previewSrc: preview9, width: 724, height: 2172, windows: [{"x":41,"y":149,"w":642,"h":406},{"x":41,"y":626,"w":642,"h":371},{"x":41,"y":1067,"w":642,"h":344},{"x":41,"y":1482,"w":642,"h":354}], photosOnTop: false },
  },
];
