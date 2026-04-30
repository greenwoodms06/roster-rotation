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
    ],
  },
};

/**
 * Returns the template list for a given sport + player count, or [] if none.
 */
function getPlayTemplates(sportKey, n) {
  return PLAY_TEMPLATES[sportKey]?.[n] || [];
}
