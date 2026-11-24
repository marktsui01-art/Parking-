/**
 * Level Definitions
 */
export const LEVELS = [
    {
        name: "Level 1: The Basics",
        description: "Park the car in the green box.",
        start: { x: 72, y: 300, heading: 0 },
        target: { x: 600, y: 300, width: 110, height: 50, angle: 0 },
        obstacles: [
            // Walls around the world
            { x: 400, y: 0, width: 800, height: 20, angle: 0 }, // Top
            { x: 400, y: 600, width: 800, height: 20, angle: 0 }, // Bottom
            { x: 0, y: 300, width: 20, height: 600, angle: 0 }, // Left
            { x: 800, y: 300, width: 20, height: 600, angle: 0 }, // Right
        ]
    },
    {
        name: "Level 2: The Alley",
        description: "Navigate through the narrow path.",
        start: { x: 72, y: 300, heading: 0 },
        target: { x: 700, y: 300, width: 110, height: 50, angle: 0 },
        obstacles: [
            // Bounds
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Alley walls
            { x: 400, y: 200, width: 400, height: 20, angle: 0 },
            { x: 400, y: 400, width: 400, height: 20, angle: 0 },
        ]
    },
    {
        name: "Level 3: Parallel Park",
        description: "Park between the two obstacles.",
        start: { x: 72, y: 450, heading: 0 },
        target: { x: 500, y: 200, width: 110, height: 46, angle: 0 },
        obstacles: [
            // Bounds
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Parked cars
            { x: 350, y: 200, width: 70, height: 40, angle: 0 },
            { x: 650, y: 200, width: 70, height: 40, angle: 0 },
        ]
    },
    {
        name: "Realistic 90° Parking",
        description: "Standard parking lot. Park in the box.",
        // 20px = 1m
        start: { x: 72, y: 300, heading: 0 },
        // Target: 2.5m x 5m = 50px x 100px (Vertical)
        target: { x: 600, y: 300, width: 50, height: 110, angle: 0 },
        obstacles: [
            // Bounds
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Parking Lines/Obstacles (simulating other cars)
            // Aisle width 6m = 120px.
            // Parking row Y = 300.
            // Neighbors. Gap is 50px (2.5m).
            // Left neighbor
            { x: 600 - 50, y: 300, width: 38, height: 94, angle: 0 }, // Car is 38x94
            // Right neighbor
            { x: 600 + 50, y: 300, width: 38, height: 94, angle: 0 }
        ]
    },
    {
        name: "Realistic Parallel Park",
        description: "Street parking. Don't hit the expensive cars.",
        // 20px = 1m
        start: { x: 72, y: 400, heading: 0 },
        // Target: 6m long = 120px. Width 2.5m = 50px.
        target: { x: 500, y: 200, width: 110, height: 42, angle: 0 }, // slightly larger for tolerance
        obstacles: [
            // Bounds
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Curb
            { x: 400, y: 150, width: 800, height: 20, angle: 0 },

            // Cars
            // Target center 500. Gap 6m+ (say 7m = 140px).
            // Rear car center: 500 - 70 - 47 (half car length) = 383
            { x: 380, y: 200, width: 94, height: 38, angle: 0 },
            // Front car center: 500 + 70 + 47 = 617
            { x: 620, y: 200, width: 94, height: 38, angle: 0 }
        ]
    },
    {
        name: "Level 6: Hardcore Parallel",
        description: "A narrow two-way street with cars on both sides. The spot is tight (6.5m gap), and the curb is unforgiving. Watch your nose swing!",
        // Scale: 20px = 1m
        // Start: x=72 (rear axle). y=220 (further up/left relative to driver)
        start: { x: 72, y: 220, heading: 0 },
        // Target: x=500. y=170 (closer to top curb). Width 6.5m=130px gap.
        // Spot size: 6.5m x 2.2m = 130px x 44px
        target: { x: 500, y: 170, width: 110, height: 44, angle: 0 },
        obstacles: [
            // Bounds
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Top Curb
            { x: 400, y: 130, width: 800, height: 20, angle: 0 },

            // Parked cars on Target Side (Top)
            // y = 170, width = 38 (1.9m)
            { x: 388, y: 170, width: 94, height: 38, angle: 0 },
            { x: 612, y: 170, width: 94, height: 38, angle: 0 },

            // Parked cars on Opposite Side (Bottom)
            // y = 280, width = 38 (1.9m)
            // Road Clearance Calculation:
            // Center to Center = 280 - 170 = 110px (5.5m)
            // Edge to Edge = 110 - 38 = 72px (3.6m total clearance)
            // Car width = 1.9m. Remaining space for swing = 3.6m - 1.9m = 1.7m (Very tight!)
            { x: 100, y: 280, width: 94, height: 38, angle: 0 },
            { x: 210, y: 280, width: 94, height: 38, angle: 0 },
            { x: 320, y: 280, width: 94, height: 38, angle: 0 },
            { x: 430, y: 280, width: 94, height: 38, angle: 0 },
            { x: 540, y: 280, width: 94, height: 38, angle: 0 },
            { x: 650, y: 280, width: 94, height: 38, angle: 0 },
            { x: 760, y: 280, width: 94, height: 38, angle: 0 },
        ]
    },

    {
        name: "Level 7: The Spiral",
        description: "A multi-story garage ramp scenario. Access the spot via the outside ramp. Shortcuts blocked! (Fixed: Wider aisle, spot closer to turn)",
        // Start: Bottom Left, lane centered. Rear axle at 72.
        start: { x: 72, y: 525, heading: 0 },
        // Target: Top, moved right (closer to the spiral turn).
        // Aisle width increased significantly.
        target: { x: 600, y: 65, width: 50, height: 110, angle: 0 },
        obstacles: [
            // Bounds
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Inner Wall (The 'island') - SHRUNK vertically for +50cm (10px) aisle width
            // Height 240 -> Top is at 300 - 120 = 180.
            // Top Wall edge is at 10. Aisle width = 170px (8.5m).
            { x: 400, y: 300, width: 560, height: 240, angle: 0 },

            // Blocking Clockwise Path
            { x: 55, y: 250, width: 70, height: 20, angle: 0 },

            // Constraining the target spot (Moved with target to x=600)
            { x: 545, y: 65, width: 40, height: 90, angle: 0 }, // Neighbor left
            { x: 655, y: 65, width: 40, height: 90, angle: 0 }, // Neighbor right
        ]
    },
    {
        name: "Level 8: 45° Squeeze",
        description: "Diagonal parking in a one-way aisle. The aisle is narrow, so you have to align perfectly before entering. Reverse in only!",
        start: { x: 72, y: 440, heading: 0 },
        // Target: 45 degrees. Moved to bottom curb (y=540).
        target: { x: 400, y: 540, width: 50, height: 110, angle: -Math.PI / 4 },
        obstacles: [
            // Bounds
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Neighbors (Aligned horizontally at y=540, spaced 60px)
            // Left Neighbor
            { x: 340, y: 540, width: 38, height: 94, angle: -Math.PI / 4 },
            // Right Neighbor
            { x: 460, y: 540, width: 38, height: 94, angle: -Math.PI / 4 },

            // Constraining Wall (Top of Aisle)
            // Spots are at y=540 (Bottom). Aisle is above.
            // Top of spots approx y=487. Aisle width ~100px.
            // Wall at y=380.
            { x: 400, y: 380, width: 800, height: 20, angle: 0 },
        ]
    },
    {
        name: "Level 9: Constrained 90°",
        description: "Realistic 2.5m painted stall (2.9m car-to-car opening) off a constrained 4.3m aisle. Pull past and back in — nose-in won't clear cleanly in a 5m car like the BMW G31!",
        start: { x: 72, y: 290, heading: 0 },
        // Target: Standard 2.5m x 5.5m painted stall (50px x 110px)
        target: { x: 500, y: 200, width: 50, height: 110, angle: 0 },
        obstacles: [
            // Bounds
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Back Wall behind parking row (removes the wide top approach)
            { x: 400, y: 130, width: 800, height: 20, angle: 0 },

            // Full parked-car row (50px / 2.5m pitch) leaving a realistic 58px (2.9m) car-to-car opening (x in [471, 529])
            { x: 52, y: 200, width: 38, height: 94, angle: 0 },
            { x: 102, y: 200, width: 38, height: 94, angle: 0 },
            { x: 152, y: 200, width: 38, height: 94, angle: 0 },
            { x: 202, y: 200, width: 38, height: 94, angle: 0 },
            { x: 252, y: 200, width: 38, height: 94, angle: 0 },
            { x: 302, y: 200, width: 38, height: 94, angle: 0 },
            { x: 352, y: 200, width: 38, height: 94, angle: 0 },
            { x: 402, y: 200, width: 38, height: 94, angle: 0 },
            { x: 452, y: 200, width: 38, height: 94, angle: 0 },
            { x: 548, y: 200, width: 38, height: 94, angle: 0 },
            { x: 598, y: 200, width: 38, height: 94, angle: 0 },
            { x: 648, y: 200, width: 38, height: 94, angle: 0 },
            { x: 698, y: 200, width: 38, height: 94, angle: 0 },
            { x: 748, y: 200, width: 38, height: 94, angle: 0 },

            // Opposite Wall
            // Parked noses at y = 247; opposite wall top edge at y = 333 -> 86px (4.3m) aisle.
            // G31 xDrive: 1-shot back-in needs 4.2m (clean); 1-shot nose-in needs 7.0m (requires rear entry).
            { x: 400, y: 343, width: 800, height: 20, angle: 0 }
        ]
    },
    {
        name: "Level 10: Long Spot, Tight Road",
        description: "The road is narrow (2.6m), but the spot is huge (6.2m). Practice staying close to the curb without hitting the other side.",
        // Scale: 20px = 1m
        start: { x: 72, y: 205, heading: 0 },
        // Target: Gap 124px (6.2m)
        target: { x: 500, y: 170, width: 120, height: 44, angle: 0 },
        obstacles: [
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },
            { x: 400, y: 130, width: 800, height: 20, angle: 0 },

            // 124px gap
            { x: 391, y: 170, width: 94, height: 38, angle: 0 },
            { x: 609, y: 170, width: 94, height: 38, angle: 0 },

            // Narrow road: 2.6m = 52px edge-to-edge
            // y = 170 + 52 + 38 = 260
            { x: 100, y: 260, width: 94, height: 38, angle: 0 },
            { x: 210, y: 260, width: 94, height: 38, angle: 0 },
            { x: 320, y: 260, width: 94, height: 38, angle: 0 },
            { x: 430, y: 260, width: 94, height: 38, angle: 0 },
            { x: 540, y: 260, width: 94, height: 38, angle: 0 },
            { x: 650, y: 260, width: 94, height: 38, angle: 0 },
            { x: 760, y: 260, width: 94, height: 38, angle: 0 },
        ]
    },
    {
        name: "Level 11: Tight Spot, Wide Road",
        description: "The spot is elitely small (5.4m), but you have all the room in the world to swing (5.0m). Focus on your entry angle.",
        // Scale: 20px = 1m
        start: { x: 72, y: 250, heading: 0 },
        // Target: Gap 108px (5.4m)
        target: { x: 500, y: 170, width: 110, height: 44, angle: 0 },
        obstacles: [
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },
            { x: 400, y: 130, width: 800, height: 20, angle: 0 },

            // 108px gap
            { x: 399, y: 170, width: 94, height: 38, angle: 0 },
            { x: 601, y: 170, width: 94, height: 38, angle: 0 },

            // Wide road: 5.0m = 100px edge-to-edge
            // y = 170 + 100 + 38 = 308
            { x: 100, y: 308, width: 94, height: 38, angle: 0 },
            { x: 210, y: 308, width: 94, height: 38, angle: 0 },
            { x: 320, y: 308, width: 94, height: 38, angle: 0 },
            { x: 430, y: 308, width: 94, height: 38, angle: 0 },
            { x: 540, y: 308, width: 94, height: 38, angle: 0 },
            { x: 650, y: 308, width: 94, height: 38, angle: 0 },
            { x: 760, y: 308, width: 94, height: 38, angle: 0 },
        ]
    },
    {
        name: "Level 12: Elite Challenge",
        description: "The Final Boss. 5.4m gap and only 3.0m road clearance. You need a perfect steering lock and careful pivoting.",
        // Scale: 20px = 1m
        start: { x: 72, y: 220, heading: 0 },
        // Target: x=500. Gap 108px (5.4m). Car is 4.8m. Total margin 60cm.
        target: { x: 500, y: 170, width: 110, height: 44, angle: 0 },
        obstacles: [
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },
            { x: 400, y: 130, width: 800, height: 20, angle: 0 },

            // 108px gap
            { x: 399, y: 170, width: 94, height: 38, angle: 0 },
            { x: 601, y: 170, width: 94, height: 38, angle: 0 },

            // Road Gap 60px (3.0m)
            { x: 100, y: 268, width: 94, height: 38, angle: 0 },
            { x: 210, y: 268, width: 94, height: 38, angle: 0 },
            { x: 320, y: 268, width: 94, height: 38, angle: 0 },
            { x: 430, y: 268, width: 94, height: 38, angle: 0 },
            { x: 540, y: 268, width: 94, height: 38, angle: 0 },
            { x: 650, y: 268, width: 94, height: 38, angle: 0 },
            { x: 760, y: 268, width: 94, height: 38, angle: 0 },
        ]
    },
    {
        name: "Level 13: Underground Parkhaus",
        description: "Exit the entry ramp, thread the lower-deck pillar chicane, swing the hairpin onto the upper deck, and squeeze past the bay-mouth pillar into the dead-end stall.",
        // Scale: 20px = 1m
        start: { x: 65, y: 530, heading: 0 },
        // Recessed dead-end corner stall flanked by concrete bay-mouth pillar (left) & parked neighbor (right)
        target: { x: 105, y: 68, width: 50, height: 110, angle: 0 },
        obstacles: [
            // Outer perimeter walls
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Central concrete deck divider wall + hairpin apex structural pillar
            { x: 315, y: 330, width: 610, height: 20, angle: 0 },
            { x: 626, y: 330, width: 26, height: 26, angle: 0 },

            // Act 1: Entry ramp ticket booth & lower-deck staggered pillar chicane
            { x: 68, y: 404, width: 116, height: 128, angle: 0 },
            { x: 245, y: 538, width: 38, height: 94, angle: 0 },
            { x: 295, y: 538, width: 38, height: 94, angle: 0 },
            { x: 270, y: 462, width: 26, height: 26, angle: 0 },
            { x: 445, y: 392, width: 38, height: 94, angle: 0 },
            { x: 495, y: 392, width: 38, height: 94, angle: 0 },
            { x: 470, y: 468, width: 26, height: 26, angle: 0 },

            // Act 2: Hairpin architectural bevels & outer concrete column
            { x: 768, y: 32, width: 80, height: 20, angle: Math.PI / 4 },
            { x: 768, y: 568, width: 80, height: 20, angle: -Math.PI / 4 },
            { x: 777, y: 330, width: 26, height: 26, angle: 0 },

            // Act 3: Upper-deck tight aisle, bay-mouth pillar, parked neighbors & opposite deck
            { x: 63, y: 102, width: 26, height: 26, angle: 0 }, // Bay-mouth concrete column (58px mouth)
            { x: 63, y: 23, width: 26, height: 26, angle: 0 },  // Rear structural column left of stall
            { x: 153, y: 68, width: 38, height: 94, angle: 0 }, // Neighbor car right of stall
            { x: 208, y: 68, width: 38, height: 94, angle: 0 },
            { x: 263, y: 68, width: 38, height: 94, angle: 0 },
            { x: 318, y: 102, width: 26, height: 26, angle: 0 },
            { x: 373, y: 68, width: 38, height: 94, angle: 0 },
            { x: 428, y: 68, width: 38, height: 94, angle: 0 },
            { x: 483, y: 68, width: 38, height: 94, angle: 0 },

            // Opposite parked-car row along central divider + corner stairwell block
            { x: 35, y: 280, width: 50, height: 80, angle: 0 },
            { x: 155, y: 268, width: 38, height: 94, angle: 0 },
            { x: 210, y: 268, width: 38, height: 94, angle: 0 },
            { x: 265, y: 268, width: 38, height: 94, angle: 0 },
            { x: 320, y: 236, width: 26, height: 26, angle: 0 },
            { x: 375, y: 268, width: 38, height: 94, angle: 0 },
            { x: 430, y: 268, width: 38, height: 94, angle: 0 },
            { x: 485, y: 268, width: 38, height: 94, angle: 0 },
            { x: 540, y: 268, width: 38, height: 94, angle: 0 },
        ]
    },
    {
        name: "Level 14: Tight 90° Car Park",
        description: "Thread four tight 90° car-park bends (4.5m) into a narrow 3.0m approach lane and squeeze into the wide 90° bay. Tuned to push even the Land Cruiser to its limit.",
        // Scale: 20px = 1m
        // Corridors: 90px (4.5m) across 4 tight 90° bends (Land Cruiser 1-shot min is 85.3px)
        // Final narrow approach lane: 60px (3.0m, y in [128, 188])
        // Wide 90° final bay: 78px target box (3.9m), 94px mouth (4.7m, x in [618, 712])
        start: { x: 56, y: 545, heading: 0 },
        target: { x: 665, y: 69, width: 78, height: 112, angle: 0 },
        obstacles: [
            // Outer perimeter walls
            { x: 400, y: 0, width: 800, height: 20, angle: 0 },
            { x: 400, y: 600, width: 800, height: 20, angle: 0 },
            { x: 0, y: 300, width: 20, height: 600, angle: 0 },
            { x: 800, y: 300, width: 20, height: 600, angle: 0 },

            // Zone 1: Upper-left stairwell core & Bend 1 apex column (bounds Entry y=[500,590] & Shaft 1 x=[136,226])
            { x: 60, y: 490, width: 100, height: 20, angle: 0 },
            { x: 126, y: 242, width: 20, height: 464, angle: 0 },
            { x: 123, y: 487, width: 26, height: 26, angle: 0 },
            { x: 62, y: 140, width: 64, height: 150, angle: 0 },

            // Zone 2: Lower-right deck & Bend 2 apex column (bounds Shaft 1 east & Mid-Deck south y=416)
            { x: 239, y: 429, width: 26, height: 26, angle: 0 },
            { x: 236, y: 516, width: 20, height: 148, angle: 0 },
            { x: 521, y: 426, width: 538, height: 20, angle: 0 },
            { x: 312, y: 532, width: 38, height: 94, angle: 0 },
            { x: 424, y: 532, width: 38, height: 94, angle: 0 },
            { x: 536, y: 532, width: 38, height: 94, angle: 0 },
            { x: 648, y: 532, width: 38, height: 94, angle: 0 },
            { x: 742, y: 532, width: 38, height: 94, angle: 0 },

            // Zone 3: Upper-middle deck & Bend 3 apex column (bounds Mid-Deck north y=326 & Shaft 2 west x=336)
            { x: 223, y: 316, width: 174, height: 20, angle: 0 },
            { x: 326, y: 155, width: 20, height: 290, angle: 0 },
            { x: 323, y: 313, width: 26, height: 26, angle: 0 },
            { x: 184, y: 74, width: 38, height: 94, angle: 0 },
            { x: 236, y: 74, width: 38, height: 94, angle: 0 },
            { x: 286, y: 74, width: 38, height: 94, angle: 0 },

            // Zone 4: Central-right deck, Bend 4 apex column & narrow 3.0m approach lane south wall (y=188)
            { x: 439, y: 231, width: 26, height: 26, angle: 0 },
            { x: 436, y: 330, width: 20, height: 172, angle: 0 },
            { x: 476, y: 228, width: 48, height: 20, angle: 0 },
            { x: 513, y: 213, width: 26, height: 50, angle: 0 },
            { x: 658, y: 198, width: 264, height: 20, angle: 0 },
            { x: 540, y: 314, width: 38, height: 94, angle: 0 },
            { x: 604, y: 314, width: 38, height: 94, angle: 0 },
            { x: 668, y: 314, width: 38, height: 94, angle: 0 },
            { x: 732, y: 314, width: 38, height: 94, angle: 0 },

            // Zone 5: Upper parking row & symmetrical columns framing the wide 90° final spot (mouth x=[618,712])
            { x: 366, y: 81, width: 38, height: 94, angle: 0 },
            { x: 415, y: 81, width: 38, height: 94, angle: 0 },
            { x: 464, y: 81, width: 38, height: 94, angle: 0 },
            { x: 513, y: 81, width: 38, height: 94, angle: 0 },
            { x: 562, y: 81, width: 38, height: 94, angle: 0 },
            { x: 605, y: 115, width: 26, height: 26, angle: 0 },
            { x: 605, y: 23, width: 26, height: 26, angle: 0 },
            { x: 725, y: 115, width: 26, height: 26, angle: 0 },
            { x: 725, y: 23, width: 26, height: 26, angle: 0 },
            { x: 764, y: 81, width: 38, height: 94, angle: 0 },
        ]
    }
];
