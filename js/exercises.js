// Übungsdatenbank.
// type 'time': dur = Sekunden (pro Seite, falls perSide)
// type 'reps': reps = Wiederholungen (pro Seite, falls perSide), rep = Sekunden pro Wiederholung (für Zeitschätzung)
// cats: mobility | strength | stretch | relax   areas: hip | back | knee | glutes | legs | core
// anim: siehe figure.js (frames, anchor, view, arrows, focus, wall, dur, hold, holds, loop)

import { mirror } from './figure.js';

const P = (base, over = {}) => ({ ...base, ...over });

// ---------- Grundposen ----------
const STAND = { torso: 180, neck: 180, uaN: 8, faN: 15, uaF: -8, faF: -4, thN: 2, shN: 0, ftN: 90, thF: -2, shF: 0, ftF: 90 };
const FRONT = { hipOff: [6, 0], shOff: [11, 0] };
const STAND_F = P(FRONT, { torso: 180, neck: 180, uaN: 12, faN: 6, uaF: -12, faF: -6, thN: 3, shN: 0, ftN: [75, 0.45], thF: -3, shF: 0, ftF: [-75, 0.45] });
const QUAD = { torso: 104, neck: 104, uaN: 0, faN: 0, uaF: -3, faF: -3, thN: 0, shN: -90, ftN: [-90, 0.8], thF: 3, shF: -90, ftF: [-90, 0.8] };
const SUPINE = { torso: -90, neck: -97, uaN: 90, faN: 90, uaF: 88, faF: 88, thN: 90, shN: 90, ftN: 180, thF: 90, shF: 90, ftF: 180 };
const HOOK = P(SUPINE, { thN: 140, shN: 36, ftN: 90, thF: 137, shF: 33, ftF: 90 });
const BRIDGE = P(HOOK, { torso: -70, neck: -100, thN: 110, shN: 45, thF: 108, shF: 43, uaN: 92, faN: 90, uaF: 90, faF: 88 });
const PRONE = { torso: 90, neck: 95, uaN: -120, faN: 60, uaF: -118, faF: 62, thN: -90, shN: -90, ftN: [-90, 0.8], thF: -90, shF: -90, ftF: [-90, 0.8] };
const SIT = { torso: 172, neck: 175, uaN: -15, faN: -10, uaF: -18, faF: -12, thN: 90, shN: 90, ftN: 180, thF: 90, shF: 90, ftF: 180 };
const KNEEL = { torso: 180, neck: 180, uaN: 5, faN: 10, uaF: -5, faF: 0, thN: 0, shN: -90, ftN: [-90, 0.8], thF: 2, shF: -90, ftF: [-90, 0.8] };
const HEELS = P(KNEEL, { thN: 72, thF: 70, uaN: 25, faN: 85, uaF: 22, faF: 82 });
const PLANK = { torso: 97, neck: 100, uaN: 0, faN: 90, uaF: 3, faF: 92, thN: -83, shN: -83, ftN: [5, 1], thF: -82, shF: -82, ftF: [5, 1] };
const SIDE = { torso: -90, neck: -100, hipOff: [0, -5], shOff: [0, -6], uaF: -95, faF: -90, uaN: [10, 0.5], faN: [70, 0.5], thN: 90, shN: 90, ftN: [10, 0.35], thF: 90, shF: 90, ftF: [10, 0.35] };
const TOP_SIDE = { torso: -90, neck: -90, uaN: 5, faN: 5, uaF: 0, faF: 0, thN: 35, shN: 115, ftN: [115, 0.6], thF: 40, shF: 120, ftF: [120, 0.6] };
const SQUAT = { torso: 140, neck: 150, thN: 92, shN: -18, ftN: 90, thF: 90, shF: -20, ftF: 90, uaN: 95, faN: 92, uaF: 93, faF: 90 };
const LUNGE_LOW = { torso: 105, neck: 110, thN: 90, shN: 0, ftN: 90, thF: -20, shF: -90, ftF: [-90, 0.8], uaN: 0, faN: 0, uaF: 3, faF: 0 };

const SEAT_F = P(FRONT, { torso: 180, neck: 180, shOff: [13, 0], uaN: 22, faN: 10, uaF: -22, faF: -10, thN: [140, 0.68], shN: [22, 0.62], ftN: [70, 0.4], thF: [-140, 0.68], shF: [-22, 0.62], ftF: [-70, 0.4] });
const WIPER_R = P(SEAT_F, { torso: 185, thN: [100, 0.9], shN: [-60, 0.6], thF: [140, 0.55], shF: [-40, 0.6] });

const COSSACK_A = P(FRONT, { torso: 180, neck: 180, thN: 30, shN: 30, ftN: [80, 0.5], thF: -30, shF: -30, ftF: [-80, 0.5], uaN: [15, 0.8], faN: [-70, 0.6], uaF: [-15, 0.8], faF: [70, 0.6] });
const COSSACK_B = P(COSSACK_A, { torso: 172, thN: 75, shN: -50, thF: -63, shF: -63, ftF: [-170, 0.5] });

const SUMO_A = P(FRONT, { torso: 180, neck: 180, thN: 20, shN: 20, ftN: [70, 0.5], thF: -20, shF: -20, ftF: [-70, 0.5], uaN: [15, 0.7], faN: [-80, 0.6], uaF: [-15, 0.7], faF: [80, 0.6] });
const SUMO_B = P(SUMO_A, { thN: 75, shN: -18, thF: -75, shF: 18 });

const REAR_QUAD = { torso: [180, 0.25], neck: [180, 0.3], hipOff: [9, 0], shOff: [13, 0], uaN: 0, faN: 0, uaF: 0, faF: 0, thN: 0, shN: [0, 0.05], ftN: [0, 0.05], thF: 0, shF: [0, 0.05], ftF: [0, 0.05] };

const BUTTERFLY = P(FRONT, { torso: 180, neck: 180, thN: [110, 0.85], shN: [-70, 0.85], ftN: [0, 0.3], thF: [-110, 0.85], shF: [70, 0.85], ftF: [0, 0.3], uaN: 0, faN: -4, uaF: 0, faF: 4 });
const STRADDLE = P(FRONT, { torso: 180, neck: 180, thN: [78, 0.85], shN: [80, 0.85], ftN: [170, 0.4], thF: [-78, 0.85], shF: [-80, 0.85], ftF: [-170, 0.4], uaN: [20, 0.8], faN: 10, uaF: [-20, 0.8], faF: -10 });

const breathe = (pose, d = {}) => P(pose, { curve: (pose.curve || 0) + (d.curve ?? 3), ...d });

export const AREAS = {
  hip: 'Hüfte', back: 'Rücken', knee: 'Knie', glutes: 'Po', legs: 'Beine', core: 'Rumpf',
};
export const CATS = {
  mobility: { label: 'Mobility', icon: '🌀' },
  strength: { label: 'Kräftigung', icon: '💪' },
  stretch: { label: 'Dehnen', icon: '🧘' },
  relax: { label: 'Entspannung', icon: '🌙' },
};

export const EXERCISES = [
  // ================= MOBILITY =================
  {
    id: 'cat-cow', name: 'Katze-Kuh', cats: ['mobility'], areas: ['back'], type: 'time', dur: 40,
    steps: ['Vierfüßlerstand: Hände unter den Schultern, Knie unter der Hüfte.', 'Einatmen: Bauch sinkt, Blick nach vorn (Kuh).', 'Ausatmen: Rücken rund machen, Kinn zur Brust (Katze).'],
    tip: 'Bewege Wirbel für Wirbel, langsam im Atemrhythmus.',
    anim: { frames: [P(QUAD, { curve: 6, neck: 150 }), P(QUAD, { curve: -9, neck: 55 })], arrows: ['spine'], focus: ['spine'], dur: 1800, hold: 400 },
  },
  {
    id: 'hip-cars', name: 'Hüftkreisen im Vierfüßler', cats: ['mobility'], areas: ['hip'], type: 'reps', reps: 5, rep: 5, perSide: true,
    steps: ['Vierfüßlerstand, Rumpf stabil halten.', 'Ein Knie zur Brust ziehen, dann seitlich öffnen.', 'Nach hinten strecken und zurück zur Mitte – ein großer, langsamer Kreis.'],
    tip: 'Nur die Hüfte bewegt sich – der Rücken bleibt ruhig und gerade.',
    anim: { frames: [QUAD, P(QUAD, { thN: 75, shN: -40 }), P(QUAD, { thN: [5, 0.35], shN: -90 }), P(QUAD, { thN: -95, shN: -150, ftN: [-120, 0.8] })], loop: 'cycle', anchor: 'wrN', arrows: ['knN'], focus: ['hip'], dur: 1000, hold: 150 },
  },
  {
    id: 'worlds-greatest', name: "World's Greatest Stretch", cats: ['mobility', 'stretch'], areas: ['hip', 'back'], type: 'time', dur: 30, perSide: true,
    steps: ['Großer Ausfallschritt, hinteres Knie am Boden.', 'Beide Hände innen neben den vorderen Fuß.', 'Inneren Arm Richtung Decke aufdrehen, Blick folgt der Hand – im Wechsel.'],
    tip: 'Hüfte tief lassen und den Brustkorb wirklich aufdrehen.',
    anim: { frames: [LUNGE_LOW, P(LUNGE_LOW, { torso: 115, uaN: 178, faN: 178, neck: 165 })], anchor: 'anN', arrows: ['wrN'], focus: ['hipF'], dur: 1500, hold: 500 },
  },
  {
    id: 'deep-squat', name: 'Tiefe Hocke halten', cats: ['mobility'], areas: ['hip', 'knee'], type: 'time', dur: 40,
    steps: ['Füße etwas breiter als hüftbreit, Zehen leicht nach außen.', 'So tief wie möglich in die Hocke sinken, Fersen am Boden.', 'Ellbogen drücken die Knie sanft nach außen, Brust aufrecht.'],
    tip: 'Wenn die Fersen abheben: Füße breiter stellen oder etwas unter die Fersen legen.',
    anim: { frames: [STAND, P(SQUAT, { torso: 155, neck: 165, thN: 100, shN: -22, thF: 98, shF: -24, uaN: 70, faN: 130, uaF: 68, faF: 128 })], anchor: 'anN', arrows: ['hip'], focus: ['hip'], dur: 1600, holds: [500, 2500] },
  },
  {
    id: 'frog-rock', name: 'Frosch-Schaukeln', cats: ['mobility', 'stretch'], areas: ['hip'], type: 'time', dur: 40,
    steps: ['Unterarmstütz, Knie weit auseinander, Unterschenkel parallel.', 'Gesäß langsam Richtung Fersen schieben.', 'Wieder nach vorn schaukeln – fließend im Rhythmus.'],
    tip: 'Nur so weit, wie es angenehm an den Innenschenkeln zieht.',
    anim: { frames: [P(QUAD, { torso: 76, neck: 80, uaN: 0, faN: 90, uaF: -2, faF: 88 }), P(QUAD, { torso: 93, neck: 95, uaN: 45, faN: 90, uaF: 43, faF: 88, thN: 40, thF: 42 })], anchor: 'knN', arrows: ['hip'], focus: ['hip'], dur: 1600, hold: 400 },
  },
  {
    id: 'windshield', name: 'Scheibenwischer (90/90)', cats: ['mobility'], areas: ['hip'], type: 'time', dur: 40,
    steps: ['Sitzen, Füße breit aufgestellt, Hände hinter dir abstützen.', 'Beide Knie gleichzeitig zu einer Seite sinken lassen (90/90-Position).', 'Über die Mitte zur anderen Seite wechseln.'],
    tip: 'Aufrecht bleiben – wer kann, nimmt die Hände vom Boden.',
    anim: { label: 'von vorn', order: 'front', frames: [SEAT_F, WIPER_R, SEAT_F, mirror(WIPER_R)], loop: 'cycle', arrows: ['knN'], focus: ['hipN', 'hipF'], dur: 1100, hold: 250 },
  },
  {
    id: 'hip-flexor', name: 'Hüftbeuger-Dehnung kniend', cats: ['mobility', 'stretch'], areas: ['hip'], type: 'time', dur: 30, perSide: true,
    steps: ['Halbkniestand: ein Fuß vorn, hinteres Knie auf der Matte.', 'Po anspannen und die Hüfte sanft nach vorn schieben.', 'Arme nach oben strecken, Oberkörper bleibt aufrecht.'],
    tip: 'Kein Hohlkreuz – Becken leicht aufrichten, dann zieht es vorn in der Leiste.',
    anim: { frames: [P(KNEEL, { thN: 90, shN: 0, ftN: 90, thF: -2, uaN: 40, faN: 80, uaF: 35, faF: 75 }), P(KNEEL, { torso: 183, thN: 98, shN: -12, ftN: 90, thF: -20, uaN: 175, faN: 178, uaF: 172, faF: 176, neck: 178 })], anchor: 'anN', arrows: ['hip', 'wrN'], focus: ['hipF'], dur: 1500, hold: 700 },
  },
  {
    id: 'cossack', name: 'Cossack Squat', cats: ['mobility', 'strength'], areas: ['hip', 'legs'], type: 'reps', reps: 6, rep: 4, perSide: true,
    steps: ['Sehr breiter Stand, Zehen leicht nach außen.', 'Gewicht auf ein Bein verlagern und tief beugen, das andere Bein bleibt gestreckt.', 'Über die Mitte zur anderen Seite – Ferse des Beugebeins bleibt am Boden.'],
    tip: 'Nur so tief, wie du sauber kommst – Tiefe kommt mit der Zeit.',
    anim: { label: 'von vorn', order: 'front', frames: [COSSACK_A, COSSACK_B, COSSACK_A, mirror(COSSACK_B)], loop: 'cycle', anchor: 'hip', arrows: ['hip'], focus: ['hipF'], dur: 1300, hold: 350 },
  },
  {
    id: 'thread-needle', name: 'Thread the Needle', cats: ['mobility'], areas: ['back'], type: 'time', dur: 30, perSide: true,
    steps: ['Vierfüßlerstand.', 'Einen Arm zur Decke aufdrehen, Blick folgt.', 'Den Arm dann unter dem Körper durchfädeln, Schulter Richtung Matte.'],
    tip: 'Die Bewegung kommt aus der Brustwirbelsäule, nicht aus der Hüfte.',
    anim: { frames: [P(QUAD, { uaN: 172, faN: 176, neck: 140, torso: 106 }), P(QUAD, { torso: 97, neck: 55, uaN: [-50, 0.6], faN: [-75, 0.7], uaF: 25, faF: -15 })], anchor: 'knN', arrows: ['wrN'], focus: ['sc'], dur: 1600, hold: 500 },
  },
  {
    id: 'open-book', name: 'Offenes Buch', cats: ['mobility', 'relax'], areas: ['back'], type: 'time', dur: 30, perSide: true,
    steps: ['Seitlage, Knie angewinkelt, Arme gestreckt vor der Brust (Ansicht von oben).', 'Oberen Arm im Bogen zur anderen Seite öffnen, Blick folgt der Hand.', 'Knie bleiben aufeinander, langsam zurück.'],
    tip: 'Ausatmen beim Öffnen – mit jeder Wiederholung etwas weiter.',
    anim: { label: 'von oben', view: 'top', frames: [TOP_SIDE, P(TOP_SIDE, { uaN: [90, 0.25], faN: [90, 0.25], shOff: [0, -3] }), P(TOP_SIDE, { uaN: 178, faN: 178, shOff: [0, -6], neck: -110 })], arrows: ['wrN'], arrowSeg: [0, 2], focus: ['sc'], dur: 1200, hold: 350 },
  },
  {
    id: 'cobra', name: 'Kobra', cats: ['mobility', 'stretch'], areas: ['back'], type: 'time', dur: 30,
    steps: ['Bauchlage, Hände neben der Brust.', 'Oberkörper langsam aufrichten, Schultern weg von den Ohren.', 'Becken bleibt am Boden – kurz halten, dann ablegen.'],
    tip: 'Nur so hoch, wie es im unteren Rücken angenehm bleibt.',
    anim: { frames: [PRONE, P(PRONE, { torso: 140, neck: 160, uaN: -20, faN: 40, uaF: -22, faF: 38 })], anchor: 'hip', arrows: ['head'], focus: ['spine'], dur: 1600, hold: 600 },
  },
  {
    id: 't-spine-quad', name: 'Brustwirbel-Rotation', cats: ['mobility'], areas: ['back'], type: 'reps', reps: 8, rep: 3, perSide: true,
    steps: ['Vierfüßlerstand, eine Hand an den Hinterkopf.', 'Ellbogen nach unten Richtung anderer Hand führen.', 'Dann weit zur Decke aufdrehen, Blick folgt dem Ellbogen.'],
    tip: 'Hüfte bleibt ruhig über den Knien.',
    anim: { frames: [P(QUAD, { uaN: [-10, 0.7], faN: [130, 0.55], neck: 70 }), P(QUAD, { torso: 106, uaN: [175, 0.85], faN: [-40, 0.55], neck: 150 })], anchor: 'knN', arrows: ['elN'], focus: ['sc'], dur: 1300, hold: 350 },
  },
  {
    id: 'heel-slides', name: 'Fersen-Gleiten', cats: ['mobility'], areas: ['knee'], type: 'reps', reps: 10, rep: 3, perSide: true,
    steps: ['Rückenlage, Beine lang.', 'Eine Ferse langsam Richtung Po ziehen, das Knie beugt sich.', 'Wieder ausstrecken – ruhig und kontrolliert.'],
    tip: 'Sanfte Knie-Mobilisation – auch an Tagen mit steifen Knien gut.',
    anim: { frames: [SUPINE, P(SUPINE, { thN: 135, shN: 42, ftN: 95 })], anchor: 'hip', arrows: ['anN'], focus: ['knN'], dur: 1300, hold: 300 },
  },
  {
    id: 'heel-sit', name: 'Fersensitz', cats: ['mobility', 'stretch'], areas: ['knee', 'legs'], type: 'time', dur: 30,
    steps: ['Aufrechter Kniestand, Fußrücken auf der Matte.', 'Langsam das Gesäß Richtung Fersen senken.', 'Unten ruhig atmen, dann wieder aufrichten.'],
    tip: 'Zieht es zu stark? Ein gefaltetes Handtuch zwischen Po und Fersen legen.',
    anim: { frames: [KNEEL, HEELS], anchor: 'knN', arrows: ['hip'], focus: ['knN'], dur: 1700, holds: [400, 1800] },
  },
  {
    id: 'couch-stretch', name: 'Couch Stretch', cats: ['mobility', 'stretch'], areas: ['hip', 'knee'], type: 'time', dur: 40, perSide: true,
    steps: ['Mit dem Rücken zur Wand knien, ein Schienbein an der Wand hoch.', 'Anderen Fuß vorn aufstellen.', 'Oberkörper langsam aufrichten, Po anspannen.'],
    tip: 'Intensive Dehnung für Hüftbeuger und Oberschenkel – langsam steigern.',
    anim: { wall: 'left', frames: [P(KNEEL, { torso: 158, neck: 168, thN: 90, shN: 0, ftN: 90, thF: -5, shF: 178, ftF: [-95, 0.6], uaN: 45, faN: 25, uaF: 43, faF: 23 }), P(KNEEL, { torso: 182, neck: 180, thN: 92, shN: -4, ftN: 90, thF: -12, shF: 176, ftF: [-95, 0.6], uaN: 15, faN: 60, uaF: 13, faF: 58 })], anchor: 'knF', arrows: ['sc'], focus: ['hipF'], dur: 1800, hold: 800 },
  },
  {
    id: 'down-dog', name: 'Herabschauender Hund (Treten)', cats: ['stretch', 'mobility'], areas: ['legs', 'back'], type: 'time', dur: 30,
    steps: ['Aus dem Vierfüßler die Hüfte nach oben schieben – umgekehrtes V.', 'Abwechselnd ein Knie beugen und die andere Ferse Richtung Boden drücken.', 'Rücken lang, Kopf locker zwischen den Armen.'],
    tip: 'Knie dürfen gebeugt sein – ein langer Rücken ist wichtiger als gestreckte Beine.',
    anim: { frames: [{ torso: 50, neck: 25, uaN: 40, faN: 40, uaF: 38, faF: 38, thN: -26, shN: -26, ftN: 90, thF: -25, shF: -25, ftF: 90 }, { torso: 50, neck: 25, uaN: 40, faN: 40, uaF: 38, faF: 38, thN: -8, shN: -55, ftN: 30, thF: -25, shF: -25, ftF: 90 }], anchor: 'wrN', arrows: ['knN'], focus: ['anF'], dur: 900, hold: 300 },
  },

  // ================= KRÄFTIGUNG =================
  {
    id: 'glute-bridge', name: 'Glute Bridge', cats: ['strength'], areas: ['glutes', 'core'], type: 'reps', reps: 15, rep: 3,
    steps: ['Rückenlage, Füße hüftbreit aufgestellt, Arme neben dem Körper.', 'Po anspannen und das Becken heben, bis Knie, Hüfte und Schultern eine Linie bilden.', 'Oben kurz halten, langsam absenken.'],
    tip: 'Drück dich über die Fersen hoch – so arbeitet der Po statt der Oberschenkel.',
    anim: { frames: [HOOK, BRIDGE], anchor: 'anN', arrows: ['hip'], focus: ['hip'], dur: 1100, holds: [300, 700] },
  },
  {
    id: 'single-bridge', name: 'Einbeinige Bridge', cats: ['strength'], areas: ['glutes', 'core'], type: 'reps', reps: 10, rep: 3, perSide: true,
    steps: ['Rückenlage, ein Fuß aufgestellt, das andere Bein gestreckt.', 'Über die Ferse das Becken heben, Becken bleibt waagerecht.', 'Kontrolliert absenken.'],
    tip: 'Das gestreckte Bein bleibt in Verlängerung des Oberschenkels.',
    anim: { frames: [P(HOOK, { thN: 138, shN: 138, ftN: 225 }), P(BRIDGE, { thN: 110, shN: 110, ftN: 195 })], anchor: 'anF', arrows: ['hip'], focus: ['hip'], dur: 1100, holds: [300, 700] },
  },
  {
    id: 'frog-pumps', name: 'Frog Pumps', cats: ['strength'], areas: ['glutes'], type: 'reps', reps: 20, rep: 2,
    steps: ['Rückenlage, Fußsohlen zusammen, Knie fallen nach außen.', 'Becken kraftvoll heben, Po fest anspannen.', 'Absenken, ohne ganz abzulegen – zügiger Rhythmus.'],
    tip: 'Kleine Bewegung, große Wirkung: oben jedes Mal bewusst anspannen.',
    anim: { frames: [P(HOOK, { thN: [140, 0.75], shN: [40, 0.8], thF: [137, 0.75], shF: [37, 0.8] }), P(BRIDGE, { torso: -76, thN: [110, 0.75], shN: [55, 0.8], thF: [108, 0.75], shF: [53, 0.8] })], anchor: 'anN', arrows: ['hip'], focus: ['hip'], dur: 700, hold: 200 },
  },
  {
    id: 'bridge-march', name: 'Bridge mit Marschieren', cats: ['strength'], areas: ['glutes', 'core'], type: 'reps', reps: 12, rep: 3,
    steps: ['In die Bridge-Position hochkommen und halten.', 'Abwechselnd ein Knie Richtung Brust heben.', 'Becken bleibt dabei oben und gerade.'],
    tip: 'Lieber langsam und stabil als schnell und wackelig.',
    anim: { frames: [BRIDGE, P(BRIDGE, { thN: 165, shN: 85, ftN: 175 })], anchor: 'anF', arrows: ['knN'], focus: ['hip'], dur: 900, hold: 300 },
  },
  {
    id: 'wall-sit', name: 'Wall Sit', cats: ['strength'], areas: ['legs', 'glutes'], type: 'time', dur: 30,
    steps: ['Rücken an die Wand, Füße etwa eine Oberschenkellänge entfernt.', 'Nach unten gleiten, bis die Knie ca. 90° gebeugt sind.', 'Position halten, gleichmäßig atmen.'],
    tip: 'Knie über den Fersen, nicht über den Zehen. Zu schwer? Etwas höher bleiben.',
    anim: { wall: 'left', frames: [P(STAND, { torso: 180, thN: 0, shN: 0, thF: 0, shF: 0 }), { torso: 180, neck: 180, thN: 90, shN: 0, ftN: 90, thF: 88, shF: -2, ftF: 90, uaN: 90, faN: 90, uaF: 88, faF: 88 }], anchor: 'hip', arrows: ['hip'], focus: ['knN'], dur: 1400, holds: [500, 3000] },
  },
  {
    id: 'plank', name: 'Unterarmstütz (Plank)', cats: ['strength'], areas: ['core'], type: 'time', dur: 30,
    steps: ['Unterarme unter den Schultern, Beine lang, Zehen aufgestellt.', 'Körper bildet eine gerade Linie von Kopf bis Fersen.', 'Bauch und Po anspannen, ruhig weiteratmen.'],
    tip: 'Hüfte weder durchhängen lassen noch hochschieben.',
    anim: { frames: [PLANK, P(PLANK, { neck: 96, curve: 1 })], anchor: 'toN', focus: ['spine'], dur: 2000, hold: 500 },
  },
  {
    id: 'side-plank', name: 'Seitstütz', cats: ['strength'], areas: ['core', 'glutes'], type: 'time', dur: 20, perSide: true,
    steps: ['Seitlage, Unterarm unter der Schulter, Beine gestreckt übereinander.', 'Hüfte heben, bis der Körper eine Linie bildet.', 'Oberen Arm zur Decke strecken und halten.'],
    tip: 'Leichter: unteres Knie auf der Matte lassen.',
    anim: { label: 'von vorn', frames: [P(PLANK, { torso: 92, thN: -76, shN: -76, thF: -75, shF: -75, hipOff: [0, -4], shOff: [0, -5], uaN: 70, faN: 160, uaF: 0, faF: [90, 0.35], ftN: [20, 0.35], ftF: [20, 0.35] }), P(PLANK, { hipOff: [0, -4], shOff: [0, -5], uaN: 180, faN: 180, uaF: 0, faF: [90, 0.35], ftN: [20, 0.35], ftF: [20, 0.35] })], anchor: 'toN', arrows: ['hip'], focus: ['hip'], dur: 1200, holds: [400, 2200] },
  },
  {
    id: 'clamshell', name: 'Clamshells', cats: ['strength'], areas: ['glutes', 'hip'], type: 'reps', reps: 15, rep: 2, perSide: true,
    steps: ['Seitlage, Knie angewinkelt, Füße aufeinander.', 'Obere Knie wie eine Muschel öffnen, Füße bleiben zusammen.', 'Langsam schließen.'],
    tip: 'Becken nicht nach hinten kippen lassen – die Bewegung ist klein.',
    anim: { label: 'von vorn', frames: [P(SIDE, { thN: [100, 0.75], shN: [-80, 0.6], ftN: [-80, 0.3], thF: [100, 0.75], shF: [-80, 0.6], ftF: [-80, 0.3] }), P(SIDE, { thN: [150, 0.8], shN: [-18, 0.74], ftN: [-80, 0.3], thF: [100, 0.75], shF: [-80, 0.6], ftF: [-80, 0.3] })], anchor: 'hip', arrows: ['knN'], focus: ['hipN'], dur: 900, hold: 300 },
  },
  {
    id: 'donkey-kick', name: 'Donkey Kicks', cats: ['strength'], areas: ['glutes'], type: 'reps', reps: 12, rep: 2, perSide: true,
    steps: ['Vierfüßlerstand, Rücken gerade.', 'Ein Bein mit 90° gebeugtem Knie nach oben drücken, Fußsohle zur Decke.', 'Kontrolliert zurück, Knie nicht ablegen.'],
    tip: 'Kein Hohlkreuz – nur so hoch, wie das Becken stabil bleibt.',
    anim: { frames: [QUAD, P(QUAD, { thN: -95, shN: 178, ftN: [-90, 0.7] })], anchor: 'wrN', arrows: ['anN'], focus: ['hip'], dur: 800, hold: 250 },
  },
  {
    id: 'fire-hydrant', name: 'Fire Hydrants', cats: ['strength', 'mobility'], areas: ['glutes', 'hip'], type: 'reps', reps: 12, rep: 2, perSide: true,
    steps: ['Vierfüßlerstand (Ansicht von hinten).', 'Ein Knie gebeugt seitlich nach oben öffnen.', 'Langsam absenken, Rumpf bleibt ruhig.'],
    tip: 'Nicht zur Seite kippen – Gewicht bleibt mittig.',
    anim: { label: 'von hinten', order: 'front', frames: [REAR_QUAD, P(REAR_QUAD, { thN: 92, shN: [0, 0.6] })], anchor: 'hip', arrows: ['knN'], focus: ['hipN'], dur: 900, hold: 250 },
  },
  {
    id: 'squat', name: 'Kniebeugen', cats: ['strength'], areas: ['legs', 'glutes'], type: 'reps', reps: 15, rep: 3,
    steps: ['Hüftbreiter Stand, Arme nach vorn.', 'Po nach hinten unten schieben, als würdest du dich setzen.', 'Über die Fersen kraftvoll aufstehen.'],
    tip: 'Knie zeigen in Richtung Zehen, Rücken bleibt lang.',
    anim: { frames: [P(STAND, { uaN: 90, faN: 90, uaF: 88, faF: 88 }), SQUAT], anchor: 'anN', arrows: ['hip'], focus: ['hip'], dur: 1100, hold: 250 },
  },
  {
    id: 'reverse-lunge', name: 'Ausfallschritt rückwärts', cats: ['strength'], areas: ['legs', 'glutes'], type: 'reps', reps: 12, rep: 4,
    steps: ['Aufrechter Stand, Hände an der Hüfte.', 'Großen Schritt nach hinten, beide Knie beugen.', 'Über die vordere Ferse zurück – Seiten abwechseln.'],
    tip: 'Oberkörper aufrecht, vorderes Knie bleibt über dem Fuß.',
    anim: { frames: [STAND, P(STAND, { torso: 178, thN: 82, shN: -2, ftN: 90, thF: -14, shF: -84, ftF: [5, 0.75], uaN: 15, faN: 30 })], anchor: 'anN', arrows: ['knF'], focus: ['hip'], dur: 1100, hold: 300 },
  },
  {
    id: 'side-leg-raise', name: 'Seitliches Beinheben', cats: ['strength'], areas: ['glutes', 'hip'], type: 'reps', reps: 15, rep: 2, perSide: true,
    steps: ['Seitlage, Beine gestreckt übereinander, Kopf auf dem Arm.', 'Oberes Bein gestreckt anheben, Zehen zeigen nach vorn.', 'Langsam absenken.'],
    tip: 'Bein leicht hinter der Körperlinie führen – dann arbeitet der seitliche Po.',
    anim: { label: 'von vorn', frames: [SIDE, P(SIDE, { thN: 125, shN: 125, ftN: [40, 0.35] })], anchor: 'hip', arrows: ['anN'], focus: ['hipN'], dur: 900, hold: 250 },
  },
  {
    id: 'calf-raise', name: 'Wadenheben', cats: ['strength'], areas: ['legs', 'knee'], type: 'reps', reps: 20, rep: 2,
    steps: ['Hüftbreiter Stand.', 'Langsam auf die Zehenspitzen hochdrücken.', 'Kontrolliert absenken.'],
    tip: 'Oben kurz halten. Zum Ausbalancieren eine Hand an die Wand.',
    anim: { frames: [STAND, P(STAND, { ftN: 28, ftF: 28 })], anchor: 'toN', arrows: ['head'], focus: ['anN'], dur: 700, hold: 300 },
  },
  {
    id: 'dead-bug', name: 'Dead Bug', cats: ['strength'], areas: ['core'], type: 'reps', reps: 12, rep: 3,
    steps: ['Rückenlage, Arme zur Decke, Beine im 90°-Winkel angehoben.', 'Einen Arm und das gegenüberliegende Bein langsam Richtung Boden strecken.', 'Zurück und Seite wechseln – unterer Rücken bleibt am Boden.'],
    tip: 'Ausatmen beim Strecken, Bauch fest.',
    anim: { frames: [P(SUPINE, { uaN: 180, faN: 180, uaF: 178, faF: 178, thN: 180, shN: 90, ftN: 180, thF: 178, shF: 88, ftF: 178 }), P(SUPINE, { uaN: -100, faN: -100, uaF: 178, faF: 178, thN: 180, shN: 90, ftN: 180, thF: 105, shF: 105, ftF: 195 })], anchor: 'hip', arrows: ['wrN', 'anF'], focus: ['spine'], dur: 1300, hold: 300 },
  },
  {
    id: 'sumo-squat', name: 'Sumo-Kniebeuge', cats: ['strength'], areas: ['legs', 'glutes', 'hip'], type: 'reps', reps: 12, rep: 3,
    steps: ['Breiter Stand, Zehen nach außen gedreht.', 'Gerade nach unten sinken, Knie drücken nach außen.', 'Über die Fersen hochdrücken, oben Po anspannen.'],
    tip: 'Oberkörper bleibt aufrecht – trainiert Po und Innenschenkel.',
    anim: { label: 'von vorn', order: 'front', frames: [SUMO_A, SUMO_B], anchor: 'hip', arrows: ['hip'], focus: ['hipN', 'hipF'], dur: 1100, hold: 250 },
  },
  {
    id: 'superman', name: 'Superman', cats: ['strength'], areas: ['back', 'glutes'], type: 'reps', reps: 12, rep: 3,
    steps: ['Bauchlage, Arme lang nach vorn.', 'Arme, Brust und Beine gleichzeitig leicht anheben.', 'Kurz halten, langsam ablegen.'],
    tip: 'Blick zur Matte – der Nacken bleibt lang.',
    anim: { frames: [P(PRONE, { uaN: 90, faN: 90, uaF: 88, faF: 88 }), P(PRONE, { torso: 104, neck: 110, uaN: 115, faN: 115, uaF: 113, faF: 113, thN: -106, shN: -108, thF: -104, shF: -106 })], anchor: 'hip', arrows: ['wrN', 'anN'], focus: ['spine'], dur: 1100, holds: [300, 700] },
  },
  {
    id: 'bird-dog', name: 'Bird-Dog', cats: ['strength'], areas: ['core', 'back', 'glutes'], type: 'reps', reps: 8, rep: 4, perSide: true,
    steps: ['Vierfüßlerstand.', 'Einen Arm nach vorn und das gegenüberliegende Bein nach hinten strecken.', 'Kurz halten, zurück – Becken bleibt waagerecht.'],
    tip: 'Stell dir ein Glas Wasser auf deinem unteren Rücken vor.',
    anim: { frames: [QUAD, P(QUAD, { uaF: 96, faF: 96, thN: -92, shN: -92, ftN: [0, 0.8] })], anchor: 'knF', arrows: ['anN', 'wrF'], focus: ['spine'], dur: 1200, holds: [300, 900] },
  },
  {
    id: 'straight-leg-raise', name: 'Beinheben im Langsitz', cats: ['strength'], areas: ['knee', 'legs'], type: 'reps', reps: 10, rep: 3, perSide: true,
    steps: ['Sitzen, Hände hinter dir abstützen, ein Bein aufgestellt.', 'Das gestreckte Bein anspannen (Zehen zu dir) und langsam anheben.', 'Kontrolliert absenken.'],
    tip: 'Stärkt den vorderen Oberschenkel – wichtig für stabile Knie.',
    anim: { frames: [{ torso: 160, neck: 165, uaN: -30, faN: -25, uaF: -32, faF: -27, thN: 90, shN: 90, ftN: 180, thF: 140, shF: 36, ftF: 90 }, { torso: 160, neck: 165, uaN: -30, faN: -25, uaF: -32, faF: -27, thN: 116, shN: 116, ftN: 206, thF: 140, shF: 36, ftF: 90 }], anchor: 'hip', arrows: ['anN'], focus: ['knN'], dur: 1100, hold: 400 },
  },
  {
    id: 'tibialis-raise', name: 'Zehenheben an der Wand', cats: ['strength'], areas: ['knee', 'legs'], type: 'reps', reps: 15, rep: 2,
    steps: ['Mit dem Rücken an die Wand lehnen, Füße einen Schritt vor.', 'Zehen und Fußspitzen so weit wie möglich anheben.', 'Langsam absenken.'],
    tip: 'Kräftigt das Schienbein – entlastet Knie und Sprunggelenk.',
    anim: { wall: 'left', frames: [{ torso: 193, neck: 188, thN: 18, shN: 18, ftN: 90, thF: 16, shF: 16, ftF: 90, uaN: -5, faN: 0, uaF: -7, faF: -2 }, { torso: 193, neck: 188, thN: 18, shN: 18, ftN: 140, thF: 16, shF: 16, ftF: 138, uaN: -5, faN: 0, uaF: -7, faF: -2 }], anchor: 'anN', arrows: ['toN'], focus: ['anN'], dur: 700, hold: 250 },
  },
  {
    id: 'y-w-raise', name: 'Y-W-Zug in Bauchlage', cats: ['strength'], areas: ['back'], type: 'reps', reps: 10, rep: 4,
    steps: ['Bauchlage, Stirn über der Matte, Arme schräg nach vorn (Y).', 'Arme anheben und die Ellbogen nach hinten zu den Rippen ziehen (W).', 'Schulterblätter zusammen, dann wieder nach vorn strecken.'],
    tip: 'Super gegen Rundrücken – Schultern bleiben weg von den Ohren.',
    anim: { frames: [P(PRONE, { torso: 93, neck: 97, uaN: 106, faN: 106, uaF: 104, faF: 104 }), P(PRONE, { torso: 95, neck: 98, uaN: -125, faN: 125, uaF: -123, faF: 123 })], anchor: 'hip', arrows: ['wrN'], focus: ['sc'], dur: 1100, hold: 400 },
  },

  // ================= DEHNEN =================
  {
    id: 'pigeon', name: 'Taube', cats: ['stretch'], areas: ['hip', 'glutes'], type: 'time', dur: 40, perSide: true,
    steps: ['Ein Bein angewinkelt vor dir ablegen, das andere lang nach hinten.', 'Hüfte gerade ausrichten, aufrecht abstützen.', 'Mit dem Ausatmen den Oberkörper nach vorn sinken lassen.'],
    tip: 'Zu intensiv? Das vordere Knie stärker beugen oder ein Kissen unter die Hüfte.',
    anim: { frames: [{ torso: 178, neck: 180, thN: [90, 0.75], shN: [-80, 0.45], ftN: [0, 0.3], thF: -90, shF: -90, ftF: [-90, 0.8], uaN: 10, faN: 8, uaF: 6, faF: 4 }, { torso: 98, neck: 100, thN: [90, 0.75], shN: [-80, 0.45], ftN: [0, 0.3], thF: -90, shF: -90, ftF: [-90, 0.8], uaN: 95, faN: 92, uaF: 93, faF: 90 }], anchor: 'hip', arrows: ['head'], focus: ['hip'], dur: 2200, holds: [700, 2500] },
  },
  {
    id: 'figure-four', name: 'Figur 4 (Piriformis)', cats: ['stretch', 'relax'], areas: ['hip', 'glutes'], type: 'time', dur: 30, perSide: true,
    steps: ['Rückenlage, Füße aufgestellt.', 'Einen Knöchel auf das andere Knie legen.', 'Hinter den Oberschenkel greifen und die Beine sanft zur Brust ziehen.'],
    tip: 'Das gekreuzte Knie sanft nach außen schieben – Dehnung tief im Po.',
    anim: { frames: [P(HOOK, { thF: 140, shF: 36, thN: [140, 0.35], shN: [140, 0.68], ftN: [150, 0.4], uaN: 120, faN: 100 }), P(HOOK, { thF: 165, shF: 80, ftF: 170, thN: [165, 0.35], shN: [165, 0.69], ftN: [175, 0.4], uaN: 135, faN: 120, uaF: 130, faF: 115 })], anchor: 'hip', arrows: ['knF'], focus: ['hip'], dur: 1800, holds: [500, 2000] },
  },
  {
    id: 'butterfly', name: 'Schmetterling', cats: ['stretch', 'mobility'], areas: ['hip'], type: 'time', dur: 30,
    steps: ['Aufrecht sitzen, Fußsohlen aneinander.', 'Füße mit den Händen umfassen, Knie sinken nach außen.', 'Knie sanft wippen lassen oder ruhig halten.'],
    tip: 'Aufrecht bleiben – die Dehnung kommt aus der Hüfte, nicht aus dem Rücken.',
    anim: { label: 'von vorn', order: 'front', frames: [P(BUTTERFLY, { thN: [125, 0.8], thF: [-125, 0.8] }), P(BUTTERFLY, { thN: [98, 0.88], thF: [-98, 0.88] })], anchor: 'hip', arrows: ['knN', 'knF'], focus: ['hipN', 'hipF'], dur: 900, hold: 200 },
  },
  {
    id: 'hamstring-supine', name: 'Beinrückseite in Rückenlage', cats: ['stretch'], areas: ['legs', 'knee'], type: 'time', dur: 30, perSide: true,
    steps: ['Rückenlage, ein Bein gestreckt am Boden.', 'Das andere Bein gestreckt anheben, Hände hinter den Oberschenkel.', 'Bein sanft zu dir ziehen, Fußspitze anziehen.'],
    tip: 'Mit einem Handtuch um den Fuß wird es leichter.',
    anim: { frames: [P(SUPINE, { thN: 145, shN: 145, ftN: 235, uaN: 140, faN: 125 }), P(SUPINE, { thN: 176, shN: 176, ftN: 266, uaN: 155, faN: 150 })], anchor: 'hip', arrows: ['anN'], focus: ['knN'], dur: 2000, holds: [500, 2000] },
  },
  {
    id: 'quad-side', name: 'Oberschenkel-Dehnung in Seitlage', cats: ['stretch'], areas: ['legs', 'knee', 'hip'], type: 'time', dur: 30, perSide: true,
    steps: ['Seitlage, unteres Bein angewinkelt (Ansicht von oben).', 'Oberen Fuß greifen und die Ferse Richtung Po ziehen.', 'Hüfte leicht nach vorn schieben.'],
    tip: 'Knie bleiben auf gleicher Höhe – kein Hohlkreuz.',
    anim: { label: 'von oben', view: 'top', frames: [P(TOP_SIDE, { thN: 90, shN: 90, ftN: [90, 0.6], uaN: 60, faN: 60 }), P(TOP_SIDE, { thN: 100, shN: -75, ftN: [-75, 0.6], uaN: 85, faN: 90 })], arrows: ['anN'], focus: ['knN'], dur: 1500, holds: [400, 2200] },
  },
  {
    id: 'seated-fold', name: 'Vorbeuge im Sitzen', cats: ['stretch', 'relax'], areas: ['legs', 'back'], type: 'time', dur: 30,
    steps: ['Sitzen, Beine lang nach vorn.', 'Aus der Hüfte nach vorn beugen, Hände Richtung Füße.', 'Rücken lang lassen und ruhig atmen.'],
    tip: 'Knie dürfen leicht gebeugt sein.',
    anim: { frames: [P(SIT, { torso: 172, uaN: 100, faN: 95, uaF: 98, faF: 93 }), P(SIT, { torso: 120, neck: 110, curve: -3, uaN: 105, faN: 100, uaF: 103, faF: 98 })], anchor: 'hip', arrows: ['wrN'], focus: ['knN'], dur: 2200, holds: [500, 2500] },
  },
  {
    id: 'straddle-bend', name: 'Seitbeuge im Grätschsitz', cats: ['stretch'], areas: ['hip', 'back'], type: 'time', dur: 30, perSide: true,
    steps: ['Grätschsitz, Beine weit geöffnet.', 'Eine Hand Richtung Fuß gleiten lassen.', 'Den anderen Arm über den Kopf zur gleichen Seite strecken.'],
    tip: 'Brust bleibt offen zur Seite – nicht nach vorn einrollen.',
    anim: { label: 'von vorn', order: 'front', frames: [STRADDLE, P(STRADDLE, { torso: 148, neck: 140, uaF: 125, faF: 105, uaN: 40, faN: 60 })], anchor: 'hip', arrows: ['wrF'], focus: ['spine'], dur: 1800, holds: [500, 2000] },
  },

  // ---------- weitere Dehnübungen ----------
  {
    id: 'lizard', name: 'Eidechse', cats: ['stretch', 'mobility'], areas: ['hip', 'legs'], type: 'time', dur: 40, perSide: true,
    steps: ['Tiefer Ausfallschritt, hinteres Knie auf der Matte.', 'Beide Hände innen neben den vorderen Fuß setzen.', 'Wenn es geht, auf die Unterarme sinken und die Hüfte tief lassen.'],
    tip: 'Das vordere Knie darf leicht nach außen fallen – das öffnet die Hüfte zusätzlich.',
    anim: { frames: [LUNGE_LOW, P(LUNGE_LOW, { torso: 82, neck: 88, uaN: 0, faN: 90, uaF: 2, faF: 92 })], anchor: 'anN', arrows: ['sc'], focus: ['hipF'], dur: 1800, holds: [500, 2500] },
  },
  {
    id: 'half-splits', name: 'Halber Spagat', cats: ['stretch'], areas: ['legs', 'knee'], type: 'time', dur: 40, perSide: true,
    steps: ['Aus dem Kniestand ein Bein nach vorn strecken, Ferse am Boden, Zehen zeigen nach oben.', 'Hüfte über das hintere Knie zurückschieben.', 'Mit langem Rücken nach vorn beugen, Hände neben das Bein.'],
    tip: 'Rücken lang statt rund – die Dehnung soll hinten im Oberschenkel sein, nicht im Rücken.',
    anim: { frames: [P(KNEEL, { thN: 59, shN: 59, ftN: 160, thF: 0, uaN: 40, faN: 20, uaF: 38, faF: 18 }), P(KNEEL, { torso: 112, neck: 110, thN: 59, shN: 59, ftN: 160, thF: 0, uaN: 75, faN: 60, uaF: 73, faF: 58 })], anchor: 'knF', arrows: ['head'], focus: ['knN'], dur: 2000, holds: [500, 2500] },
  },
  {
    id: 'kneeling-adductor', name: 'Adduktoren-Dehnung kniend', cats: ['stretch', 'mobility'], areas: ['hip', 'legs'], type: 'time', dur: 40, perSide: true,
    steps: ['Kniestand, ein Bein gestreckt zur Seite ausstellen, Fuß flach.', 'Hände auf die Oberschenkel oder vor dir abstützen.', 'Hüfte langsam Richtung Boden und leicht nach hinten sinken lassen.'],
    tip: 'Die Dehnung sitzt innen am gestreckten Bein – Knie zeigt nach oben.',
    anim: { label: 'von vorn', order: 'front', frames: [P(FRONT, { torso: 180, neck: 180, thN: 59, shN: 59, ftN: [20, 0.35], thF: 0, shF: [0, 0.12], ftF: [0, 0.1], uaN: 25, faN: 40, uaF: -12, faF: -6 }), P(FRONT, { torso: 172, neck: 175, thN: 66, shN: 66, ftN: [20, 0.35], thF: -6, shF: [0, 0.12], ftF: [0, 0.1], uaN: 35, faN: 55, uaF: -6, faF: 6 })], anchor: 'knF', arrows: ['sc'], focus: ['hipN'], dur: 1800, holds: [500, 2000] },
  },
  {
    id: 'gate-pose', name: 'Seitdehnung im Kniestand', cats: ['stretch'], areas: ['back', 'hip'], type: 'time', dur: 30, perSide: true,
    steps: ['Kniestand, ein Bein gestreckt zur Seite ausstellen.', 'Arme seitlich ausbreiten.', 'Zum gestreckten Bein neigen, der obere Arm zieht im Bogen über den Kopf.'],
    tip: 'Brust bleibt offen nach vorn – stell dir vor, du stehst zwischen zwei Glasscheiben.',
    anim: { label: 'von vorn', order: 'front', frames: [P(FRONT, { torso: 180, neck: 180, thN: 59, shN: 59, ftN: [20, 0.35], thF: 0, shF: [0, 0.12], ftF: [0, 0.1], uaN: 90, faN: 90, uaF: -90, faF: -90 }), P(FRONT, { torso: 150, neck: 140, thN: 59, shN: 59, ftN: [20, 0.35], thF: 0, shF: [0, 0.12], ftF: [0, 0.1], uaN: 30, faN: 20, uaF: 150, faF: 115 })], anchor: 'knF', arrows: ['wrF'], focus: ['spine'], dur: 2000, holds: [500, 2200] },
  },
  {
    id: 'reclined-butterfly', name: 'Liegender Schmetterling', cats: ['stretch', 'relax'], areas: ['hip'], type: 'time', dur: 60, breath: 'calm',
    steps: ['Rückenlage, Fußsohlen aneinander, Knie fallen nach außen (Ansicht von oben).', 'Arme locker neben dem Körper, Handflächen nach oben.', 'Schwer werden lassen und ruhig in den Bauch atmen.'],
    tip: 'Kissen unter die Knie, wenn die Dehnung zu stark ist.',
    anim: { view: 'top', label: 'von oben', frames: [{ torso: -90, neck: -90, shOff: [0, 12], hipOff: [0, 7], uaN: 75, faN: 85, uaF: 105, faF: 95, thN: 55, shN: 150, ftN: [90, 0.4], thF: 125, shF: 30, ftF: [90, 0.4] }, { torso: -90, neck: -90, curve: 1, shOff: [0, 12], hipOff: [0, 7], uaN: 75, faN: 85, uaF: 105, faF: 95, thN: 38, shN: 152, ftN: [90, 0.4], thF: 142, shF: 28, ftF: [90, 0.4] }], arrows: ['knN', 'knF'], focus: ['hipN', 'hipF'], dur: 3000, hold: 800 },
  },
  {
    id: 'straddle-fold', name: 'Grätsche mit Vorbeuge', cats: ['stretch'], areas: ['hip', 'legs', 'back'], type: 'time', dur: 40,
    steps: ['Grätschsitz, Beine so weit wie angenehm geöffnet, Zehen zeigen nach oben.', 'Aufrichten und die Hände vor dir aufsetzen.', 'Mit langem Rücken langsam nach vorn wandern.'],
    tip: 'Kissen unter den Po kippt das Becken nach vorn und macht es leichter.',
    anim: { label: 'von vorn', order: 'front', frames: [STRADDLE, P(STRADDLE, { torso: [180, 0.55], neck: [180, 0.6], uaN: [12, 0.75], faN: [6, 0.75], uaF: [-12, 0.75], faF: [-6, 0.75] })], anchor: 'hip', arrows: ['head'], focus: ['hipN', 'hipF'], dur: 2200, holds: [600, 2500] },
  },
  {
    id: 'banana', name: 'Bananen-Seitdehnung', cats: ['stretch', 'relax'], areas: ['back', 'hip'], type: 'time', dur: 40, perSide: true,
    steps: ['Rückenlage, Arme lang über den Kopf (Ansicht von oben).', 'Oberkörper und Beine zur selben Seite wandern lassen – der Körper wird zur Banane.', 'Gesäß bleibt am Boden, ruhig in die gedehnte Flanke atmen.'],
    tip: 'Den Knöchel überkreuzen verstärkt die Dehnung an der Außenseite.',
    anim: { view: 'top', label: 'von oben', frames: [{ torso: -90, neck: -90, shOff: [0, 11], hipOff: [0, 6], uaN: -100, faN: -95, uaF: -80, faF: -85, thN: 92, shN: 92, ftN: [90, 0.35], thF: 88, shF: 88, ftF: [90, 0.35] }, { torso: -78, neck: -70, curve: -9, shOff: [0, 11], hipOff: [0, 6], uaN: -60, faN: -50, uaF: -45, faF: -35, thN: 62, shN: 58, ftN: [60, 0.35], thF: 58, shF: 54, ftF: [55, 0.35] }], arrows: ['wrF', 'anN'], focus: ['spine'], dur: 2000, holds: [500, 2500] },
  },
  {
    id: 'head-to-knee', name: 'Einbeinige Vorbeuge', cats: ['stretch'], areas: ['legs', 'back'], type: 'time', dur: 40, perSide: true,
    steps: ['Sitzen, ein Bein lang, die andere Fußsohle innen an den Oberschenkel.', 'Arme nach oben strecken, Rücken lang machen.', 'Über das gestreckte Bein nach vorn beugen, Hände Richtung Fuß.'],
    tip: 'Erst lang, dann tief: Bewegung aus der Hüfte, nicht aus dem Rücken.',
    anim: { frames: [P(SIT, { torso: 176, neck: 178, uaN: 172, faN: 176, uaF: 170, faF: 174, thF: [85, 0.45], shF: [-100, 0.45], ftF: [0, 0.3] }), P(SIT, { torso: 118, neck: 110, curve: -3, uaN: 98, faN: 95, uaF: 96, faF: 93, thF: [85, 0.45], shF: [-100, 0.45], ftF: [0, 0.3] })], anchor: 'hip', arrows: ['wrN'], focus: ['knN'], dur: 2200, holds: [600, 2500] },
  },
  {
    id: 'chest-opener', name: 'Brustöffner im Kniestand', cats: ['stretch', 'mobility'], areas: ['back'], type: 'time', dur: 30,
    steps: ['Aufrechter Kniestand, Hände hinter dem Rücken verschränken.', 'Schulterblätter zusammenziehen, Brustbein nach vorn-oben schieben.', 'Arme gestreckt leicht vom Rücken abheben.'],
    tip: 'Gegenmittel zum Sitzen am Schreibtisch – Kinn bleibt lang, kein Hohlkreuz.',
    anim: { frames: [P(KNEEL, { uaN: -15, faN: 5, uaF: -17, faF: 3 }), P(KNEEL, { torso: 186, neck: 190, uaN: -45, faN: -52, uaF: -47, faF: -54 })], anchor: 'knN', arrows: ['wrN'], focus: ['sc'], dur: 1800, holds: [500, 2200] },
  },
  {
    id: 'neck-stretch', name: 'Nacken-Seitdehnung', cats: ['stretch', 'relax'], areas: ['back'], type: 'time', dur: 30, perSide: true,
    steps: ['Aufrecht im Schneidersitz sitzen.', 'Kopf zur Seite neigen, die Hand legt sich sanft über den Kopf.', 'Die andere Schulter aktiv nach unten schieben.'],
    tip: 'Nicht am Kopf ziehen – das Gewicht der Hand reicht völlig.',
    anim: { label: 'von vorn', order: 'front', frames: [P(FRONT, { torso: 180, neck: 180, thN: [100, 0.85], shN: [-105, 0.6], ftN: [0, 0.3], thF: [-100, 0.85], shF: [105, 0.6], ftF: [0, 0.3], uaN: 20, faN: 55, uaF: -20, faF: -55 }), P(FRONT, { torso: 180, neck: 150, thN: [100, 0.85], shN: [-105, 0.6], ftN: [0, 0.3], thF: [-100, 0.85], shF: [105, 0.6], ftF: [0, 0.3], uaN: 165, faN: -105, uaF: -18, faF: -8 })], anchor: 'hip', arrows: ['head'], focus: ['sc'], dur: 1800, holds: [500, 2500] },
  },
  {
    id: 'seated-twist', name: 'Drehsitz im Sitzen', cats: ['stretch', 'mobility'], areas: ['back', 'hip'], type: 'time', dur: 30, perSide: true,
    steps: ['Aufrecht im Schneidersitz sitzen.', 'Eine Hand an das gegenüberliegende Knie, die andere hinter dir abstützen.', 'Mit jedem Ausatmen etwas weiter aufdrehen, Blick über die Schulter.'],
    tip: 'Erst lang machen, dann drehen – so entsteht Platz zwischen den Wirbeln.',
    anim: { label: 'von vorn', order: 'front', frames: [P(FRONT, { torso: 180, neck: 180, thN: [100, 0.85], shN: [-105, 0.6], ftN: [0, 0.3], thF: [-100, 0.85], shF: [105, 0.6], ftF: [0, 0.3], uaN: 20, faN: 55, uaF: -20, faF: -55 }), P(FRONT, { torso: 182, neck: 188, shOff: [5, 0], thN: [100, 0.85], shN: [-105, 0.6], ftN: [0, 0.3], thF: [-100, 0.85], shF: [105, 0.6], ftF: [0, 0.3], uaN: -25, faN: -60, uaF: [10, 0.6], faF: [0, 0.5] })], anchor: 'hip', arrows: ['wrN'], focus: ['spine'], dur: 1800, holds: [500, 2500] },
  },
  {
    id: 'toe-squat', name: 'Zehensitz', cats: ['stretch'], areas: ['knee', 'legs'], type: 'time', dur: 30,
    steps: ['Kniestand, Zehen aufstellen.', 'Langsam das Gesäß auf die Fersen sinken lassen.', 'Aufrecht sitzen und atmen – die Dehnung sitzt in den Fußsohlen.'],
    tip: 'Intensiv! Bei Bedarf Hände vor dir abstützen und mit wenig Gewicht beginnen.',
    anim: { frames: [P(KNEEL, { shN: -80, ftN: [5, 0.9], shF: -80, ftF: [5, 0.9] }), P(HEELS, { shN: -80, ftN: [5, 0.9], shF: -80, ftF: [5, 0.9] })], anchor: 'knN', arrows: ['hip'], focus: ['toN'], dur: 1800, holds: [400, 2500] },
  },
  {
    id: 'kneeling-quad', name: 'Oberschenkel-Dehnung kniend', cats: ['stretch'], areas: ['legs', 'hip', 'knee'], type: 'time', dur: 30, perSide: true,
    steps: ['Halbkniestand, das hintere Knie auf der Matte.', 'Hinteren Fuß mit der Hand greifen und Richtung Po ziehen.', 'Po anspannen, Hüfte leicht nach vorn schieben.'],
    tip: 'Eine Hand am vorderen Knie oder an der Wand hilft beim Gleichgewicht.',
    anim: { frames: [P(KNEEL, { thF: 90, shF: 0, ftF: 90, thN: -8, shN: -90, uaN: 0, faN: 5, uaF: 40, faF: 70 }), P(KNEEL, { thF: 92, shF: -4, ftF: 90, thN: -14, shN: 172, ftN: [-110, 0.8], uaN: -10, faN: -2, uaF: 40, faF: 70 })], anchor: 'anF', arrows: ['anN'], focus: ['knN'], dur: 1800, holds: [500, 2500] },
  },
  {
    id: 'ragdoll', name: 'Stehende Vorbeuge', cats: ['stretch', 'relax'], areas: ['back', 'legs'], type: 'time', dur: 40,
    steps: ['Hüftbreiter Stand, Knie leicht gebeugt.', 'Oberkörper nach vorn hängen lassen, Ellbogen greifen.', 'Kopf locker, sanft von Seite zu Seite schwingen.'],
    tip: 'Beim Aufrichten Wirbel für Wirbel aufrollen, der Kopf kommt zuletzt.',
    anim: { frames: [STAND, P(STAND, { torso: 38, neck: 14, curve: -4, thN: 24, shN: -14, thF: 22, shF: -16, uaN: 4, faN: 0, uaF: 2, faF: -2 })], anchor: 'anN', arrows: ['head'], focus: ['spine'], dur: 2400, holds: [600, 2600] },
  },
  {
    id: 'knee-hug-single', name: 'Ein Knie zur Brust', cats: ['stretch', 'relax'], areas: ['hip', 'back'], type: 'time', dur: 30, perSide: true,
    steps: ['Rückenlage, beide Beine lang.', 'Ein Knie mit den Händen zur Brust ziehen.', 'Das andere Bein bleibt lang und schwer am Boden.'],
    tip: 'Dehnt den Po des angezogenen Beins und den Hüftbeuger des langen Beins.',
    anim: { frames: [SUPINE, P(SUPINE, { thN: -150, shN: 110, ftN: 195, uaN: 150, faN: 120, uaF: 148, faF: 118 })], anchor: 'hip', arrows: ['knN'], focus: ['hipN'], dur: 1800, holds: [500, 2500] },
  },

  // ================= ENTSPANNUNG =================
  {
    id: 'child-pose', name: 'Kindhaltung', cats: ['relax', 'stretch'], areas: ['back', 'hip'], type: 'time', dur: 45, breath: 'calm',
    steps: ['Knien, Gesäß auf die Fersen sinken lassen.', 'Oberkörper auf den Oberschenkeln ablegen, Arme lang nach vorn.', 'Tief in den Rücken atmen und loslassen.'],
    tip: 'Knie gern weiter auseinander, wenn es angenehmer ist.',
    anim: { frames: [{ torso: 82, neck: 85, uaN: 80, faN: 88, uaF: 78, faF: 86, thN: 70, shN: -90, ftN: [-90, 0.8], thF: 68, shF: -90, ftF: [-90, 0.8] }, { torso: 86, neck: 86, curve: -3, uaN: 80, faN: 88, uaF: 78, faF: 86, thN: 70, shN: -90, ftN: [-90, 0.8], thF: 68, shF: -90, ftF: [-90, 0.8] }], anchor: 'knN', focus: ['spine'], dur: 3000, hold: 800 },
  },
  {
    id: 'happy-baby', name: 'Happy Baby', cats: ['relax', 'stretch'], areas: ['hip'], type: 'time', dur: 40,
    steps: ['Rückenlage, Knie Richtung Achseln ziehen.', 'Außenkanten der Füße greifen, Sohlen zur Decke.', 'Sanft von Seite zu Seite schaukeln.'],
    tip: 'Unterer Rücken darf schwer in die Matte sinken.',
    anim: { frames: [{ torso: -90, neck: -97, thN: -118, shN: 176, ftN: 90, thF: -115, shF: 174, ftF: 90, uaN: 160, faN: 165, uaF: 158, faF: 163 }, { torso: -90, neck: -97, thN: -128, shN: 172, ftN: 90, thF: -125, shF: 170, ftF: 90, uaN: 165, faN: 170, uaF: 163, faF: 168 }], anchor: 'hip', focus: ['hip'], dur: 1500, hold: 300 },
  },
  {
    id: 'knees-chest', name: 'Knie zur Brust', cats: ['relax'], areas: ['back'], type: 'time', dur: 40,
    steps: ['Rückenlage, beide Knie zur Brust ziehen.', 'Hände um die Knie legen.', 'Sanft vor und zurück oder im Kreis schaukeln.'],
    tip: 'Massiert den unteren Rücken – einfach genießen.',
    anim: { frames: [{ torso: -90, neck: -97, thN: -160, shN: 105, ftN: 180, thF: -158, shF: 103, ftF: 178, uaN: 140, faN: 115, uaF: 138, faF: 113 }, { torso: -90, neck: -97, thN: -140, shN: 120, ftN: 195, thF: -138, shF: 118, ftF: 193, uaN: 150, faN: 125, uaF: 148, faF: 123 }], anchor: 'hip', arrows: ['knN'], focus: ['spine'], dur: 1600, hold: 300 },
  },
  {
    id: 'supine-twist', name: 'Drehsitz in Rückenlage', cats: ['relax', 'stretch'], areas: ['back', 'hip'], type: 'time', dur: 40, perSide: true,
    steps: ['Rückenlage, Arme seitlich ausgebreitet (Ansicht von oben).', 'Knie anwinkeln und gemeinsam zu einer Seite sinken lassen.', 'Kopf zur anderen Seite drehen, Schultern bleiben am Boden.'],
    tip: 'Mit jedem Ausatmen ein bisschen mehr loslassen.',
    anim: { label: 'von oben', view: 'top', frames: [{ torso: -90, neck: -90, shOff: [0, 12], hipOff: [0, 7], uaN: 0, faN: 0, uaF: 180, faF: 180, thN: 90, shN: 90, ftN: [90, 0.3], thF: 90, shF: 90, ftF: [90, 0.3] }, { torso: -90, neck: -105, shOff: [0, 12], hipOff: [0, 5], uaN: 0, faN: 0, uaF: 180, faF: 180, thN: 35, shN: 105, ftN: [105, 0.4], thF: 40, shF: 110, ftF: [110, 0.4] }], arrows: ['knN'], focus: ['spine'], dur: 2200, holds: [500, 2500] },
  },
  {
    id: 'legs-wall', name: 'Beine an die Wand', cats: ['relax'], areas: ['legs', 'back'], type: 'time', dur: 60, breath: 'calm',
    steps: ['Seitlich an die Wand setzen, dann auf den Rücken drehen.', 'Beine gestreckt an der Wand ablegen, Po nah an der Wand.', 'Arme entspannt ablegen, ruhig atmen.'],
    tip: 'Fördert die Entspannung und entlastet müde Beine.',
    anim: { wall: 'right', frames: [{ torso: -90, neck: -97, thN: 180, shN: 180, ftN: [-95, 0.8], thF: 178, shF: 178, ftF: [-97, 0.8], uaN: -150, faN: -100, uaF: 92, faF: 90 }, { torso: -90, neck: -97, curve: 2, thN: 180, shN: 180, ftN: [-95, 0.8], thF: 178, shF: 178, ftF: [-97, 0.8], uaN: -150, faN: -100, uaF: 92, faF: 90 }], anchor: 'hip', focus: ['spine'], dur: 3500, hold: 500 },
  },
  {
    id: 'box-breathing', name: 'Box Breathing', cats: ['relax'], areas: ['core'], type: 'time', dur: 64, breath: 'box',
    steps: ['Rückenlage, Füße aufgestellt, Hände auf dem Bauch.', '4 Sekunden einatmen, 4 halten, 4 ausatmen, 4 halten.', 'Folge einfach der Anzeige.'],
    tip: 'Beruhigt das Nervensystem – perfekt zum Abschluss.',
    anim: { frames: [P(HOOK, { uaN: 150, faN: 70, uaF: 148, faF: 68 }), P(HOOK, { curve: 4, uaN: 150, faN: 75, uaF: 148, faF: 73 })], anchor: 'hip', focus: ['spine'], dur: 4000, hold: 4000 },
  },
  {
    id: 'body-scan', name: 'Ruhelage & Körper-Scan', cats: ['relax'], areas: ['back'], type: 'time', dur: 60, breath: 'calm',
    steps: ['Rückenlage, Beine lang, Arme leicht vom Körper weg.', 'Augen schließen, Atem fließen lassen.', 'Gedanklich von den Füßen bis zum Kopf jede Region entspannen.'],
    tip: 'Kein Ziel, kein Leistungsdruck – einfach da sein.',
    anim: { frames: [P(SUPINE, { uaN: 80, faN: 85, uaF: 82, faF: 86 }), P(SUPINE, { curve: 2, uaN: 80, faN: 85, uaF: 82, faF: 86 })], anchor: 'hip', focus: ['spine'], dur: 4000, hold: 600 },
  },
];

export const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

for (const e of EXERCISES) {
  e.wall = !!e.anim.wall;
  e.cat = e.cats[0];
}

// geschätzte Dauer einer Übung in Sekunden (beide Seiten)
export function exerciseSeconds(e, scale = 1) {
  const sides = e.perSide ? 2 : 1;
  const one = e.type === 'time' ? e.dur * scale : Math.round(e.reps * scale) * e.rep;
  return one * sides + (e.perSide ? 5 : 0);
}

export function formatAmount(e, scale = 1) {
  const side = e.perSide ? ' / Seite' : '';
  if (e.type === 'time') return `${Math.round(e.dur * scale)} Sek.${side}`;
  return `${Math.max(4, Math.round(e.reps * scale))}×${side}`;
}
