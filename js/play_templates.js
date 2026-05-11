/**
 * play_templates.js — Bundled starter plays per sport + player count.
 *
 * Coordinates are 0–100 percentages on the field SVG (same as formations.js
 * coords). loadTemplate() in field.js converts these to SVG pixel space.
 *
 * Each template:
 *   - name:       short label shown in the picker
 *   - formation:  index into SPORTS[sport].byCount[n].formations
 *   - positions:  optional override of dot placements (else formation default)
 *   - routes:     [{ points: [[x,y], ...], style: 'solid' | 'dashed' }, ...]
 *
 * Convention: solid = player movement, dashed = ball / pass trajectory.
 * Field y-axis: 0 = attacking goal/basket, 100 = own end.
 */

const PLAY_TEMPLATES = {
  soccer: {
    5: [
      // 2-1-1 (formation 0): GK[50,91] LB[25,68] RB[75,68] CM[50,44] ST[50,18]
      {
        name: 'Corner Kick R',
        formation: 0,
        positions: { 'GK': [50, 88], 'RB': [94, 7], 'ST': [40, 20], 'CM': [58, 22], 'LB': [28, 30] },
        routes: [
          { points: [[94, 7], [52, 13]], style: 'dashed' },   // corner cross
          { points: [[40, 20], [45, 9]], style: 'solid' },     // ST near post
          { points: [[58, 22], [56, 9]], style: 'solid' },     // CM far post
          { points: [[28, 30], [42, 17]], style: 'solid' },    // LB late central
        ],
      },
    ],
    7: [
      // 2-3-1 (formation 0): GK[50,91] LB[22,72] RB[78,72] LW[15,44] CM[50,50] RW[85,44] ST[50,16]
      {
        name: 'Corner Kick R',
        formation: 0,
        positions: { 'GK': [50, 88], 'RW': [94, 6], 'ST': [38, 20], 'CM': [58, 22], 'LW': [48, 28], 'LB': [26, 32], 'RB': [72, 30] },
        routes: [
          { points: [[94, 6], [54, 13]], style: 'dashed' },    // corner cross
          { points: [[38, 20], [44, 9]], style: 'solid' },     // ST near post
          { points: [[58, 22], [56, 9]], style: 'solid' },     // CM far post
          { points: [[48, 28], [50, 17]], style: 'solid' },    // LW late central
          { points: [[26, 32], [34, 22]], style: 'solid' },    // LB edge of box
        ],
      },
      {
        name: 'Counter Attack',
        formation: 0,
        routes: [
          { points: [[50, 91], [15, 44]], style: 'dashed' },   // GK throw to LW
          { points: [[15, 44], [18, 26]], style: 'solid' },    // LW carry up wing
          { points: [[18, 26], [50, 14]], style: 'dashed' },   // LW cross
          { points: [[50, 16], [44, 10]], style: 'solid' },    // ST near post
          { points: [[85, 44], [68, 18]], style: 'solid' },    // RW far-side run
          { points: [[50, 50], [52, 26]], style: 'solid' },    // CM late
        ],
      },
    ],
    9: [
      // 3-3-2 (formation 0): GK[50,91] LB[20,72] CB[50,75] RB[80,72] LM[20,48] CM[50,50] RM[80,48] LF[35,20] RF[65,20]
      {
        name: 'Corner Kick R',
        formation: 0,
        positions: { 'GK': [50, 88], 'RM': [93, 6], 'LF': [38, 18], 'RF': [60, 16], 'CM': [50, 24], 'LM': [28, 26], 'CB': [48, 28], 'LB': [24, 32], 'RB': [72, 30] },
        routes: [
          { points: [[93, 6], [52, 13]], style: 'dashed' },    // corner cross
          { points: [[38, 18], [44, 9]], style: 'solid' },     // LF near post
          { points: [[60, 16], [56, 9]], style: 'solid' },     // RF far post
          { points: [[50, 24], [50, 16]], style: 'solid' },    // CM edge
          { points: [[48, 28], [48, 20]], style: 'solid' },    // CB late central
        ],
      },
      {
        name: 'Build-Out',
        formation: 0,
        routes: [
          { points: [[50, 91], [50, 75]], style: 'dashed' },   // GK to CB
          { points: [[50, 75], [20, 72]], style: 'dashed' },   // CB to LB
          { points: [[20, 72], [20, 52]], style: 'solid' },    // LB carry
          { points: [[20, 52], [22, 48]], style: 'dashed' },   // LB to LM
          { points: [[20, 48], [35, 22]], style: 'dashed' },   // LM forward to LF
          { points: [[35, 20], [40, 12]], style: 'solid' },    // LF run to near post
          { points: [[22, 48], [28, 28]], style: 'solid' },    // LM overlap
        ],
      },
    ],
    11: [
      // 4-3-3 (formation 0): GK[50,91] LB[12,70] LCB[35,74] RCB[65,74] RB[88,70] LM[22,48] CM[50,50] RM[78,48] LW[12,24] RW[88,24] ST[50,18]
      {
        name: 'Corner Kick R',
        formation: 0,
        positions: { 'GK': [50, 88], 'RW': [94, 6], 'ST': [38, 18], 'LW': [60, 16], 'CM': [50, 24], 'RM': [34, 26], 'LM': [66, 28], 'LCB': [44, 30], 'RCB': [56, 30], 'LB': [26, 44], 'RB': [74, 44] },
        routes: [
          { points: [[94, 6], [52, 13]], style: 'dashed' },    // corner cross
          { points: [[38, 18], [44, 9]], style: 'solid' },     // ST near post
          { points: [[60, 16], [56, 9]], style: 'solid' },     // LW far post
          { points: [[50, 24], [50, 16]], style: 'solid' },    // CM edge
          { points: [[44, 30], [46, 20]], style: 'solid' },    // LCB late
          { points: [[56, 30], [54, 20]], style: 'solid' },    // RCB late
        ],
      },
      {
        name: 'Counter Attack',
        formation: 0,
        routes: [
          { points: [[50, 91], [12, 70]], style: 'dashed' },   // GK throw to LB
          { points: [[12, 70], [14, 42]], style: 'solid' },    // LB carry up wing
          { points: [[14, 42], [12, 24]], style: 'dashed' },   // LB to LW
          { points: [[12, 24], [14, 16]], style: 'solid' },    // LW dribble
          { points: [[14, 16], [50, 14]], style: 'dashed' },   // LW cross
          { points: [[50, 18], [45, 11]], style: 'solid' },    // ST near post
          { points: [[88, 24], [62, 16]], style: 'solid' },    // RW far post
          { points: [[50, 50], [50, 26]], style: 'solid' },    // CM late
        ],
      },
    ],
  },

  football: {
    5: [
      // Spread (formation 0): QB[50,57] C[50,47] WR1[12,47] WR2[88,47] RB[50,65]
      {
        name: 'Slants',
        formation: 0,
        routes: [
          { points: [[12, 47], [25, 32]], style: 'solid' },    // WR1 slant
          { points: [[88, 47], [75, 32]], style: 'solid' },    // WR2 slant
          { points: [[50, 65], [30, 55]], style: 'solid' },    // RB swing
          { points: [[50, 57], [25, 32]], style: 'dashed' },   // pass to WR1
        ],
      },
      {
        name: 'Sweep Right',
        formation: 0,
        routes: [
          { points: [[50, 65], [62, 54], [80, 38]], style: 'solid' }, // RB sweep
          { points: [[12, 47], [15, 30]], style: 'solid' },            // WR1 block deep
          { points: [[88, 47], [85, 28]], style: 'solid' },            // WR2 block deep
        ],
      },
    ],
    6: [
      // Spread (formation 0): QB[50,57] C[50,47] WR1[10,47] WR2[90,47] TE[70,47] RB[50,65]
      {
        name: 'Slants',
        formation: 0,
        routes: [
          { points: [[10, 47], [25, 32]], style: 'solid' },    // WR1 slant
          { points: [[90, 47], [75, 32]], style: 'solid' },    // WR2 slant
          { points: [[70, 47], [60, 38]], style: 'solid' },    // TE drag
          { points: [[50, 65], [30, 55]], style: 'solid' },    // RB swing
          { points: [[50, 57], [25, 32]], style: 'dashed' },   // pass to WR1
        ],
      },
      {
        name: 'Counter Left',
        formation: 0,
        routes: [
          { points: [[50, 65], [42, 55], [22, 40]], style: 'solid' }, // RB counter
          { points: [[70, 47], [55, 42]], style: 'solid' },            // TE pull left
          { points: [[10, 47], [12, 30]], style: 'solid' },            // WR1 block
          { points: [[90, 47], [85, 30]], style: 'solid' },            // WR2 block
        ],
      },
    ],
    7: [
      // Spread (formation 0): QB[50,57] C[50,47] WR1[8,47] WR2[92,47] WR3[80,49] RB[50,65] TE[30,47]
      {
        name: 'Slants',
        formation: 0,
        routes: [
          { points: [[8, 47], [22, 32]], style: 'solid' },     // WR1 slant
          { points: [[92, 47], [78, 32]], style: 'solid' },    // WR2 slant
          { points: [[80, 49], [65, 34]], style: 'solid' },    // WR3 slant
          { points: [[50, 65], [25, 55]], style: 'solid' },    // RB swing left
          { points: [[50, 57], [22, 32]], style: 'dashed' },   // pass to WR1
        ],
      },
      {
        name: 'Sweep Right',
        formation: 0,
        routes: [
          { points: [[50, 65], [62, 55], [82, 38]], style: 'solid' }, // RB sweep right
          { points: [[30, 47], [48, 42], [62, 40]], style: 'solid' }, // TE pull right (lead block)
          { points: [[8, 47], [12, 30]], style: 'solid' },             // WR1 vertical block
          { points: [[92, 47], [85, 28]], style: 'solid' },            // WR2 vertical
          { points: [[80, 49], [75, 26]], style: 'solid' },            // WR3 vertical
        ],
      },
      {
        name: 'Smash',
        formation: 0,
        routes: [
          { points: [[8, 47], [10, 38]], style: 'solid' },             // WR1 hitch
          { points: [[80, 49], [88, 22]], style: 'solid' },            // WR3 corner
          { points: [[92, 47], [78, 28]], style: 'solid' },            // WR2 post
          { points: [[30, 47], [22, 38]], style: 'solid' },            // TE drag
          { points: [[50, 65], [38, 58]], style: 'solid' },            // RB check release
          { points: [[50, 57], [88, 22]], style: 'dashed' },           // pass to WR3 corner
        ],
      },
      {
        // DEFENSE — dots repurposed as defenders (slot labels are flexible).
        // 3 down linemen, 2 flat defenders, 2 deep-half safeties.
        name: 'Cover 2 (D)',
        formation: 0,
        positions: { 'C': [50, 43], 'WR1': [34, 43], 'WR2': [66, 43], 'TE': [26, 32], 'RB': [74, 32], 'WR3': [35, 16], 'QB': [65, 16] },
        routes: [
          { points: [[50, 43], [50, 49]], style: 'solid' },            // NT rush
          { points: [[34, 43], [40, 48]], style: 'solid' },            // LDE rush
          { points: [[66, 43], [60, 48]], style: 'solid' },            // RDE rush
          { points: [[26, 32], [20, 37]], style: 'solid' },            // flat defender L
          { points: [[74, 32], [80, 37]], style: 'solid' },            // flat defender R
          { points: [[35, 16], [28, 8]], style: 'solid' },             // deep half L
          { points: [[65, 16], [72, 8]], style: 'solid' },             // deep half R
        ],
      },
    ],
    8: [
      // I-Formation (formation 0): QB[50,57] C[50,47] LG[38,47] RG[62,47] WR1[10,47] WR2[90,47] TE[74,47] RB[50,70]
      {
        name: 'Power Right',
        formation: 0,
        routes: [
          { points: [[50, 70], [62, 55], [76, 40]], style: 'solid' }, // RB off-tackle right
          { points: [[74, 47], [82, 32]], style: 'solid' },            // TE release
          { points: [[10, 47], [15, 30]], style: 'solid' },            // WR1 block deep
          { points: [[90, 47], [88, 30]], style: 'solid' },            // WR2 block deep
        ],
      },
      {
        name: 'Slant-Flat',
        formation: 0,
        routes: [
          { points: [[10, 47], [25, 32]], style: 'solid' },            // WR1 slant
          { points: [[90, 47], [78, 32]], style: 'solid' },            // WR2 slant
          { points: [[74, 47], [78, 40]], style: 'solid' },            // TE drag
          { points: [[50, 70], [25, 60]], style: 'solid' },            // RB flat left
          { points: [[50, 57], [25, 60]], style: 'dashed' },           // pass to RB flat
        ],
      },
    ],
    11: [
      // I-Formation (formation 0): QB[50,57] C[50,47] LG[40,47] RG[60,47] LT[28,47] RT[72,47]
      //                            WR1[8,47] WR2[92,47] TE[82,47] FB[50,63] RB[50,70]
      {
        name: 'Power Right',
        formation: 0,
        routes: [
          { points: [[50, 70], [60, 55], [78, 40]], style: 'solid' }, // RB off-tackle right
          { points: [[50, 63], [65, 52]], style: 'solid' },            // FB lead block
          { points: [[82, 47], [82, 32]], style: 'solid' },            // TE release
          { points: [[8, 47], [12, 30]], style: 'solid' },             // WR1 block deep
          { points: [[92, 47], [88, 30]], style: 'solid' },            // WR2 block deep
        ],
      },
      {
        name: 'Slant-Flat',
        formation: 0,
        routes: [
          { points: [[8, 47], [22, 30]], style: 'solid' },             // WR1 slant
          { points: [[92, 47], [78, 30]], style: 'solid' },            // WR2 slant
          { points: [[82, 47], [85, 40]], style: 'solid' },            // TE curl
          { points: [[50, 70], [25, 60]], style: 'solid' },            // RB flat left
          { points: [[50, 63], [38, 55]], style: 'solid' },            // FB block check
          { points: [[50, 57], [22, 30]], style: 'dashed' },           // pass to WR1 slant
        ],
      },
      {
        name: 'Sprint Out Right',
        formation: 0,
        routes: [
          { points: [[50, 57], [70, 50]], style: 'solid' },            // QB sprint out
          { points: [[82, 47], [88, 32]], style: 'solid' },            // TE corner
          { points: [[92, 47], [78, 28]], style: 'solid' },            // WR2 post
          { points: [[8, 47], [12, 28]], style: 'solid' },             // WR1 go
          { points: [[50, 63], [55, 50]], style: 'solid' },            // FB lead protect
          { points: [[50, 70], [40, 60]], style: 'solid' },            // RB block backside
          { points: [[70, 50], [88, 32]], style: 'dashed' },           // pass to TE corner
        ],
      },
      {
        // DEFENSE — dots repurposed as defenders. 4 down linemen, 3 linebackers,
        // 2 corners, 2 safeties — the classic 4-3.
        name: '4-3 Defense (D)',
        formation: 0,
        positions: {
          'LT': [28, 43], 'LG': [42, 43], 'RG': [58, 43], 'RT': [72, 43],
          'C': [30, 33], 'QB': [50, 33], 'TE': [70, 33],
          'WR1': [12, 28], 'WR2': [88, 28],
          'RB': [36, 16], 'FB': [64, 16],
        },
        routes: [
          { points: [[28, 43], [31, 48]], style: 'solid' },            // LDE rush
          { points: [[42, 43], [44, 48]], style: 'solid' },            // DT rush
          { points: [[58, 43], [56, 48]], style: 'solid' },            // DT rush
          { points: [[72, 43], [69, 48]], style: 'solid' },            // RDE rush
          { points: [[50, 33], [50, 45]], style: 'solid' },            // MLB fill
          { points: [[30, 33], [24, 29]], style: 'solid' },            // WLB drop
          { points: [[70, 33], [76, 29]], style: 'solid' },            // SLB drop
          { points: [[12, 28], [14, 20]], style: 'solid' },            // CB drop L
          { points: [[88, 28], [86, 20]], style: 'solid' },            // CB drop R
          { points: [[36, 16], [42, 9]], style: 'solid' },             // SS deep
          { points: [[64, 16], [58, 9]], style: 'solid' },             // FS deep
        ],
      },
      {
        // DEFENSE — nickel package: slot corner blitzes off the edge while the
        // Mike blitzes the A-gap; one CB locks man, safeties rotate.
        name: 'Nickel Blitz (D)',
        formation: 0,
        positions: {
          'LT': [28, 43], 'LG': [42, 43], 'RG': [58, 43], 'RT': [72, 43],
          'C': [35, 33], 'QB': [55, 33], 'TE': [68, 34],
          'WR1': [18, 38], 'WR2': [86, 27],
          'RB': [40, 16], 'FB': [62, 16],
        },
        routes: [
          { points: [[18, 38], [24, 46]], style: 'solid' },            // nickel CB blitz
          { points: [[28, 43], [30, 48]], style: 'solid' },            // DL rush
          { points: [[42, 43], [44, 48]], style: 'solid' },            // DL rush
          { points: [[58, 43], [56, 48]], style: 'solid' },            // DL rush
          { points: [[72, 43], [70, 48]], style: 'solid' },            // DL rush
          { points: [[55, 33], [53, 46]], style: 'solid' },            // MLB blitz A-gap
          { points: [[35, 33], [38, 28]], style: 'solid' },            // LB drop hook
          { points: [[68, 34], [72, 29]], style: 'solid' },            // SLB drop curl
          { points: [[86, 27], [84, 20]], style: 'solid' },            // CB lock man
          { points: [[40, 16], [30, 24]], style: 'solid' },            // S rotate down
          { points: [[62, 16], [55, 9]], style: 'solid' },             // S deep middle
        ],
      },
    ],
  },

  basketball: {
    3: [
      // Standard (formation 0): G[50,22] F[78,48] C[22,48]
      {
        name: 'Pick & Roll',
        formation: 0,
        routes: [
          { points: [[22, 48], [42, 30], [28, 55]], style: 'solid' },  // C up to screen, roll back
          { points: [[50, 22], [50, 32], [62, 45]], style: 'solid' },  // G use screen, drive
          { points: [[78, 48], [88, 18]], style: 'solid' },             // F corner relocate
        ],
      },
      {
        name: 'Give & Go',
        formation: 0,
        routes: [
          { points: [[50, 22], [30, 32], [12, 55]], style: 'solid' },  // G pass + cut
          { points: [[22, 48], [35, 38]], style: 'solid' },             // C pop out
          { points: [[78, 48], [50, 22]], style: 'solid' },             // F replace top
          { points: [[50, 22], [22, 48]], style: 'dashed' },            // pass G to C
        ],
      },
      {
        // DEFENSE — pack the paint: top defender pressures the ball, the two
        // bigs protect the rim and rotate to help. Basket end is high y.
        name: 'Pack the Paint (D)',
        formation: 0,
        positions: { 'G': [50, 32], 'F': [68, 55], 'C': [32, 55] },
        routes: [
          { points: [[50, 32], [60, 36]], style: 'solid' },            // G slide with ball
          { points: [[68, 55], [62, 64]], style: 'solid' },            // F ball-side block
          { points: [[32, 55], [42, 60]], style: 'solid' },            // C weak-side rim help
        ],
      },
    ],
    5: [
      // Standard (formation 0): PG[50,20] SG[82,32] SF[18,32] PF[72,58] C[50,68]
      // y=0 = basket end; y=100 = backcourt. C in the post, PG up top.
      {
        name: 'Pick & Roll',
        formation: 0,
        routes: [
          { points: [[50, 68], [50, 30], [50, 55]], style: 'solid' },  // C up to screen, then roll back
          { points: [[50, 20], [70, 30], [78, 50]], style: 'solid' },  // PG use screen, drive right
          { points: [[82, 32], [88, 15]], style: 'solid' },             // SG lift to wing
          { points: [[18, 32], [12, 15]], style: 'solid' },             // SF lift to wing
          { points: [[72, 58], [25, 58]], style: 'solid' },             // PF skip to weak side
        ],
      },
      {
        name: 'Motion',
        formation: 0,
        routes: [
          { points: [[50, 20], [25, 30], [12, 55]], style: 'solid' },   // PG pass + cut to corner
          { points: [[18, 32], [50, 22]], style: 'solid' },             // SF replace top
          { points: [[82, 32], [75, 15]], style: 'solid' },             // SG lift
          { points: [[50, 68], [50, 50]], style: 'solid' },             // C high post
          { points: [[72, 58], [88, 42]], style: 'solid' },             // PF lift to wing
          { points: [[50, 20], [18, 32]], style: 'dashed' },            // pass PG → SF
        ],
      },
      {
        name: 'Horns',
        formation: 0,
        routes: [
          { points: [[50, 68], [35, 40]], style: 'solid' },             // C to left elbow
          { points: [[72, 58], [65, 40]], style: 'solid' },             // PF to right elbow
          { points: [[50, 20], [50, 32]], style: 'solid' },             // PG drive between elbows
          { points: [[82, 32], [88, 15]], style: 'solid' },             // SG corner
          { points: [[18, 32], [12, 15]], style: 'solid' },             // SF corner
        ],
      },
      {
        // DEFENSE — 2-3 zone: two guards up top, three across the back.
        // Routes show the shift after the ball enters the right wing.
        name: '2-3 Zone (D)',
        formation: 0,
        positions: { 'PG': [40, 40], 'SG': [60, 40], 'SF': [22, 62], 'PF': [78, 62], 'C': [50, 72] },
        routes: [
          { points: [[60, 40], [75, 48]], style: 'solid' },            // SG cover right wing
          { points: [[78, 62], [72, 68]], style: 'solid' },            // PF cover right block
          { points: [[50, 72], [58, 66]], style: 'solid' },            // C slide ball-side
          { points: [[22, 62], [34, 58]], style: 'solid' },            // SF weak-side help
          { points: [[40, 40], [52, 42]], style: 'solid' },            // PG cover top ball-side
        ],
      },
      {
        // DEFENSE — full-court 1-2-1-1 press; routes show the trap after the
        // ball is inbounded to the left.
        name: 'Full-Court Press (D)',
        formation: 0,
        positions: { 'PG': [50, 16], 'SG': [30, 26], 'SF': [70, 26], 'C': [50, 44], 'PF': [50, 76] },
        routes: [
          { points: [[30, 26], [28, 32]], style: 'solid' },            // SG trap left
          { points: [[50, 16], [34, 28]], style: 'solid' },            // PG recover to ball
          { points: [[50, 44], [40, 38]], style: 'solid' },            // C rotate cover middle
          { points: [[50, 76], [55, 55]], style: 'solid' },            // PF rotate up to fill
          { points: [[70, 26], [60, 42]], style: 'solid' },            // SF split the floor
        ],
      },
    ],
  },

  hockey: {
    4: [
      // Standard (formation 0): G[50,88] D[50,60] LW[25,32] RW[75,32]
      {
        name: '3-on-2 Rush',
        formation: 0,
        positions: { 'G': [50, 90], 'D': [50, 55], 'LW': [25, 36], 'RW': [75, 36] },
        routes: [
          { points: [[50, 55], [50, 28]], style: 'solid' },    // D carry up middle
          { points: [[50, 28], [75, 32]], style: 'dashed' },   // drop pass to RW
          { points: [[75, 32], [48, 9]], style: 'dashed' },    // RW shot
          { points: [[25, 36], [44, 12]], style: 'solid' },    // LW drive net
        ],
      },
    ],
    6: [
      // Standard (formation 0): G[50,88] LD[28,65] RD[72,65] LW[18,35] C[50,38] RW[82,35]
      {
        name: 'O-Zone Faceoff Win',
        formation: 0,
        positions: { 'G': [50, 88], 'C': [46, 30], 'RW': [58, 28], 'LW': [22, 26], 'LD': [38, 46], 'RD': [64, 46] },
        routes: [
          { points: [[46, 30], [38, 46]], style: 'dashed' },   // C wins draw back to LD
          { points: [[38, 46], [64, 46]], style: 'dashed' },   // LD cross-ice to RD
          { points: [[64, 46], [50, 8]], style: 'dashed' },    // RD one-timer
          { points: [[22, 26], [44, 12]], style: 'solid' },    // LW net-front screen
          { points: [[58, 28], [55, 14]], style: 'solid' },    // RW crash net
        ],
      },
      {
        name: 'Breakout (Wheel)',
        formation: 0,
        positions: { 'G': [50, 90], 'LD': [32, 80], 'RD': [62, 80], 'C': [44, 62], 'LW': [20, 55], 'RW': [78, 58] },
        routes: [
          { points: [[32, 80], [20, 58]], style: 'dashed' },   // LD behind net to LW on wall
          { points: [[20, 58], [22, 32]], style: 'solid' },    // LW up the boards
          { points: [[44, 62], [40, 38]], style: 'solid' },    // C swing through middle
          { points: [[78, 58], [80, 28]], style: 'solid' },    // RW stretch wide
        ],
      },
      {
        // Power play, 1-3-1 setup (formation 1: G[50,88] LD[50,55] RD[25,30] C[50,28] LW[75,30] RW[50,12])
        name: 'Power Play 1-3-1',
        formation: 1,
        routes: [
          { points: [[50, 55], [25, 30]], style: 'dashed' },   // point to left half-wall
          { points: [[25, 30], [50, 28]], style: 'dashed' },   // to bumper
          { points: [[50, 28], [75, 30]], style: 'dashed' },   // to right half-wall
          { points: [[75, 30], [48, 9]], style: 'dashed' },    // one-timer
          { points: [[50, 12], [46, 9]], style: 'solid' },     // net-front screen/tip
        ],
      },
    ],
  },

  lacrosse: {
    6: [
      // Box (formation 0): G[50,88] D1[30,70] D2[70,70] M[50,48] A1[30,22] A2[70,22]
      {
        name: 'Give & Go',
        formation: 0,
        positions: { 'G': [50, 88], 'D1': [32, 68], 'D2': [68, 68], 'M': [50, 42], 'A1': [32, 22], 'A2': [68, 22] },
        routes: [
          { points: [[50, 42], [32, 22]], style: 'dashed' },   // M pass to A1
          { points: [[50, 42], [44, 14]], style: 'solid' },    // M cut to goal
          { points: [[32, 22], [44, 16]], style: 'dashed' },   // A1 return feed
          { points: [[68, 22], [58, 16]], style: 'solid' },    // A2 backside crash
        ],
      },
    ],
    10: [
      // Standard (formation 0): G[50,88] D1[25,73] D2[50,78] D3[75,73] M1[22,48] M2[50,46] M3[78,48] A1[25,22] A2[50,18] A3[75,22]
      {
        name: 'Clear Up Field',
        formation: 0,
        positions: { 'G': [50, 88], 'D1': [28, 76], 'D2': [52, 80], 'D3': [72, 76], 'M1': [26, 56], 'M2': [50, 54], 'M3': [74, 56], 'A1': [30, 26], 'A2': [50, 22], 'A3': [70, 26] },
        routes: [
          { points: [[50, 88], [28, 76]], style: 'dashed' },   // G clears to D1
          { points: [[28, 76], [28, 54]], style: 'solid' },    // D1 carry up
          { points: [[28, 54], [48, 52]], style: 'dashed' },   // D1 to M2
          { points: [[50, 54], [50, 28]], style: 'solid' },    // M2 carry into O-zone
          { points: [[50, 22], [42, 24]], style: 'solid' },    // A2 pops to receive
        ],
      },
      {
        // 1-4-1 settled offense (formation 1: G[50,88] D1[25,73] D2[50,78] D3[75,73] A1[50,5] A2[25,18] M1[30,30] M3[70,30] A3[75,18] M2[50,12])
        name: 'Dodge from X',
        formation: 1,
        routes: [
          { points: [[50, 5], [34, 9], [40, 18]], style: 'solid' },  // A1 dodge around the goal
          { points: [[40, 18], [30, 30]], style: 'dashed' },         // A1 feed to M1
          { points: [[30, 30], [48, 9]], style: 'dashed' },          // M1 shot
          { points: [[25, 18], [44, 12]], style: 'solid' },          // A2 crease slide
          { points: [[70, 30], [60, 22]], style: 'solid' },          // M3 backside
        ],
      },
    ],
    12: [
      // 1-4-1 settled offense (formation 1: G[50,90] D1..D5 back; A1[50,5] A2[25,18] M1[30,30] M3[70,30] A3[75,18] M2[50,12])
      {
        name: 'Settled Offense 1-4-1',
        formation: 1,
        routes: [
          { points: [[50, 5], [25, 18]], style: 'dashed' },    // X to left wing
          { points: [[25, 18], [30, 30]], style: 'dashed' },   // to left up
          { points: [[30, 30], [70, 30]], style: 'dashed' },   // skip to right up
          { points: [[70, 30], [75, 18]], style: 'dashed' },   // to right wing
          { points: [[75, 18], [50, 9]], style: 'dashed' },    // shot
          { points: [[50, 12], [46, 9]], style: 'solid' },     // crease seal/tip
        ],
      },
    ],
  },

  baseball: {
    9: [
      // Standard (formation 0): P[50,68] C[50,87] 1B[70,62] 2B[60,48] SS[40,48] 3B[30,62] LF[18,25] CF[50,15] RF[82,25]
      // Home plate is bottom (high y); the outfield is the top.
      {
        name: 'Bunt Defense',
        formation: 0,
        routes: [
          { points: [[70, 62], [60, 80]], style: 'solid' },   // 1B charge home
          { points: [[30, 62], [40, 80]], style: 'solid' },   // 3B charge home
          { points: [[50, 68], [50, 80]], style: 'solid' },   // P charge
          { points: [[60, 48], [70, 62]], style: 'solid' },   // 2B cover first
          { points: [[50, 87], [50, 82]], style: 'solid' },   // C field / direct
        ],
      },
      {
        name: 'Double Play 6-4-3',
        formation: 0,
        routes: [
          { points: [[55, 82], [40, 49]], style: 'dashed' },  // grounder to SS
          { points: [[40, 49], [53, 49]], style: 'dashed' },  // SS flip to 2B at bag
          { points: [[53, 49], [70, 62]], style: 'dashed' },  // 2B relay to 1B
          { points: [[60, 48], [53, 49]], style: 'solid' },   // 2B move to cover bag
          { points: [[70, 62], [72, 60]], style: 'solid' },   // 1B stretch for throw
        ],
      },
    ],
    10: [
      // Standard (formation 0): P[50,68] C[50,87] 1B[70,62] 2B[60,48] SS[40,48] 3B[30,62] LF[16,28] LCF[38,14] RCF[62,14] RF[84,28]
      {
        name: 'Relay Home',
        formation: 0,
        routes: [
          { points: [[38, 14], [36, 12]], style: 'solid' },   // LCF fields deep ball
          { points: [[36, 12], [40, 48]], style: 'dashed' },  // LCF throw to SS (relay)
          { points: [[40, 48], [50, 84]], style: 'dashed' },  // SS relay home
          { points: [[40, 48], [42, 40]], style: 'solid' },   // SS to relay position
          { points: [[50, 87], [50, 84]], style: 'solid' },   // C blocks plate
        ],
      },
    ],
  },
};

/**
 * Returns the template list for a given sport + player count, or [] if none.
 */
function getPlayTemplates(sportKey, n) {
  return PLAY_TEMPLATES[sportKey]?.[n] || [];
}
