// Exported from the cartridge by tools/export_visuals.py
globalThis.VISUALS = {
  "width": 160,
  "height": 144,
  "scenes": {
    "room": {
      "src": "assets/room.png",
      "width": 160,
      "height": 144,
      "bankAddress": "07:67cb"
    },
    "hall1": {
      "src": "assets/hall1.png",
      "width": 320,
      "height": 144,
      "bankAddress": "07:6ad6"
    },
    "hall2": {
      "src": "assets/hall2.png",
      "width": 320,
      "height": 144,
      "bankAddress": "07:6e64"
    },
    "hall3": {
      "src": "assets/hall3.png",
      "width": 320,
      "height": 144,
      "bankAddress": "07:71d2"
    },
    "initial": {
      "src": "assets/initial.png",
      "width": 160,
      "height": 144,
      "bankAddress": "07:7404"
    }
  },
  "door": {
    "frames": [
      "assets/door0.png",
      "assets/door1.png",
      "assets/door2.png",
      "assets/door3.png"
    ],
    "origin": [
      0,
      0
    ],
    "actorPosition": [
      72,
      120
    ],
    "oamRenderOrigin": [
      72,
      112
    ],
    "palette": 208,
    "animationSets": [
      [
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          0
        ]
      ],
      [
        [
          1,
          3
        ],
        [
          1,
          3
        ],
        [
          1,
          3
        ],
        [
          1,
          3
        ],
        [
          1,
          3
        ],
        [
          1,
          3
        ],
        [
          1,
          3
        ],
        [
          1,
          3
        ]
      ]
    ],
    "initialTickMask": 255,
    "roomTickMask": 255,
    "animationPaused": true,
    "tickRule": "(game_time & anim_tick) == 0",
    "openingSet": 1,
    "noLoop": true,
    "manualFrames": [
      {
        "afterFrames": 54,
        "absoluteFrame": 2
      },
      {
        "afterFrames": 12,
        "absoluteFrame": 3
      }
    ],
    "holdAfterLastFrame": 72
  },
  "font": {
    "src": "assets/digits.png",
    "characters": "0123456789- .e+",
    "glyphWidth": 8,
    "glyphHeight": 8,
    "x": 48,
    "y": 16,
    "digits": 9,
    "padding": "zero",
    "negativeSignFirst": true,
    "fontAddress": "04:6112",
    "backgroundHasLeadingZeroAtX": 40
  }
};
