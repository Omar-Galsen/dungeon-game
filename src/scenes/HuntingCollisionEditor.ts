import Phaser from "phaser";

type CollisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default class HuntingCollisionEditor extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;

  private boxes: CollisionBox[] = [];

  private drawing = false;

  private startX = 0;
  private startY = 0;

  private selectedBox = -1;

  private boxText!: Phaser.GameObjects.Text;

  private readonly MAP_WIDTH = 3000;
  private readonly MAP_HEIGHT = 3000;

  constructor() {
    super("HuntingCollisionEditor");
  }

  preload() {
    this.load.image(
      "huntingGround",
      "/assets/maps/HuntingG.png"
    );
  }

  create() {
    // =====================================================
    // MAP
    // =====================================================

    const map = this.add.image(
      0,
      0,
      "huntingGround"
    );

    map.setOrigin(0, 0);

    map.setDisplaySize(
      this.MAP_WIDTH,
      this.MAP_HEIGHT
    );

    // =====================================================
    // GRAPHICS
    // =====================================================

    this.graphics =
      this.add.graphics();

    this.graphics.setDepth(10);

    // =====================================================
    // CAMERA
    // =====================================================

    this.cameras.main.setBounds(
      0,
      0,
      this.MAP_WIDTH,
      this.MAP_HEIGHT
    );

    // Start zoomed out so you can see the whole map
    this.cameras.main.setZoom(0.23);

    // Center the 3000x3000 map
    this.cameras.main.centerOn(
      this.MAP_WIDTH / 2,
      this.MAP_HEIGHT / 2
    );

    // =====================================================
    // MOUSE
    // =====================================================

    this.input.on(
      "pointerdown",
      this.startDrawing,
      this
    );

    this.input.on(
      "pointermove",
      this.drawPreview,
      this
    );

    this.input.on(
      "pointerup",
      this.finishDrawing,
      this
    );

    // =====================================================
    // KEYBOARD
    // =====================================================

    const keyboard =
      this.input.keyboard;

    if (!keyboard) {
      throw new Error(
        "Keyboard unavailable"
      );
    }

    // Delete selected box
    keyboard.on(
      "keydown-DELETE",
      () => {
        if (
          this.selectedBox !== -1
        ) {
          this.boxes.splice(
            this.selectedBox,
            1
          );

          this.selectedBox = -1;

          this.redraw();
        }
      }
    );

    // Clear all
    keyboard.on(
      "keydown-C",
      () => {
        this.boxes = [];

        this.selectedBox = -1;

        this.redraw();
      }
    );

    // Save
    keyboard.on(
      "keydown-S",
      () => {
        this.saveBoxes();
      }
    );

    // Export
    keyboard.on(
      "keydown-E",
      () => {
        this.exportBoxes();
      }
    );

    // =====================================================
    // CAMERA CONTROLS
    // =====================================================

    keyboard.on(
      "keydown-PLUS",
      () => {
        this.changeZoom(0.05);
      }
    );

    keyboard.on(
      "keydown-MINUS",
      () => {
        this.changeZoom(-0.05);
      }
    );

    // =====================================================
    // UI
    // =====================================================

    const panel =
      this.add.rectangle(
        15,
        15,
        400,
        145,
        0x111111,
        0.92
      );

    panel.setOrigin(0, 0);

    panel.setScrollFactor(0);

    panel.setDepth(100);

    this.add.text(
      30,
      25,
      "HUNTING MAP COLLISION EDITOR",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#f5d76e",
      }
    )
      .setScrollFactor(0)
      .setDepth(101);

    this.add.text(
      30,
      55,
      "CLICK + DRAG  Draw collision\n" +
      "CLICK BOX      Select\n" +
      "DELETE         Remove\n" +
      "C              Clear all\n" +
      "S              Save\n" +
      "E              Export JSON\n" +
      "+ / -          Zoom",
      {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#ffffff",
        lineSpacing: 3,
      }
    )
      .setScrollFactor(0)
      .setDepth(101);

    this.boxText =
      this.add.text(
        30,
        132,
        "Boxes: 0",
        {
          fontFamily: "Arial",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#ff5555",
        }
      );

    this.boxText
      .setScrollFactor(0)
      .setDepth(101);

    // =====================================================
    // INITIAL DRAW
    // =====================================================

    this.redraw();
  }

  // =====================================================
  // WORLD MOUSE POSITION
  // =====================================================

  private getWorldPosition(
    pointer: Phaser.Input.Pointer
  ) {
    return this.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y
    );
  }

  // =====================================================
  // START DRAWING
  // =====================================================

  private startDrawing(
    pointer: Phaser.Input.Pointer
  ) {
    const pos =
      this.getWorldPosition(
        pointer
      );

    const x =
      Phaser.Math.Clamp(
        pos.x,
        0,
        this.MAP_WIDTH
      );

    const y =
      Phaser.Math.Clamp(
        pos.y,
        0,
        this.MAP_HEIGHT
      );

    // Check existing boxes first
    for (
      let i =
        this.boxes.length - 1;
      i >= 0;
      i--
    ) {
      const box =
        this.boxes[i];

      const bx =
        box.x *
        this.MAP_WIDTH;

      const by =
        box.y *
        this.MAP_HEIGHT;

      const bw =
        box.width *
        this.MAP_WIDTH;

      const bh =
        box.height *
        this.MAP_HEIGHT;

      if (
        x >= bx &&
        x <= bx + bw &&
        y >= by &&
        y <= by + bh
      ) {
        this.selectedBox = i;

        this.redraw();

        return;
      }
    }

    // Create new box
    this.selectedBox = -1;

    this.drawing = true;

    this.startX = x;
    this.startY = y;
  }

  // =====================================================
  // PREVIEW
  // =====================================================

  private drawPreview(
    pointer: Phaser.Input.Pointer
  ) {
    if (!this.drawing) {
      return;
    }

    const pos =
      this.getWorldPosition(
        pointer
      );

    const currentX =
      Phaser.Math.Clamp(
        pos.x,
        0,
        this.MAP_WIDTH
      );

    const currentY =
      Phaser.Math.Clamp(
        pos.y,
        0,
        this.MAP_HEIGHT
      );

    this.redraw();

    const x =
      Math.min(
        this.startX,
        currentX
      );

    const y =
      Math.min(
        this.startY,
        currentY
      );

    const width =
      Math.abs(
        currentX -
        this.startX
      );

    const height =
      Math.abs(
        currentY -
        this.startY
      );

    this.graphics.fillStyle(
      0xff0000,
      0.35
    );

    this.graphics.lineStyle(
      4,
      0xff0000,
      1
    );

    this.graphics.fillRect(
      x,
      y,
      width,
      height
    );

    this.graphics.strokeRect(
      x,
      y,
      width,
      height
    );
  }

  // =====================================================
  // FINISH DRAWING
  // =====================================================

  private finishDrawing(
    pointer: Phaser.Input.Pointer
  ) {
    if (!this.drawing) {
      return;
    }

    this.drawing = false;

    const pos =
      this.getWorldPosition(
        pointer
      );

    const currentX =
      Phaser.Math.Clamp(
        pos.x,
        0,
        this.MAP_WIDTH
      );

    const currentY =
      Phaser.Math.Clamp(
        pos.y,
        0,
        this.MAP_HEIGHT
      );

    const x =
      Math.min(
        this.startX,
        currentX
      );

    const y =
      Math.min(
        this.startY,
        currentY
      );

    const width =
      Math.abs(
        currentX -
        this.startX
      );

    const height =
      Math.abs(
        currentY -
        this.startY
      );

    if (
      width < 10 ||
      height < 10
    ) {
      this.redraw();
      return;
    }

    this.boxes.push({
      x:
        x /
        this.MAP_WIDTH,

      y:
        y /
        this.MAP_HEIGHT,

      width:
        width /
        this.MAP_WIDTH,

      height:
        height /
        this.MAP_HEIGHT,
    });

    this.selectedBox =
      this.boxes.length - 1;

    this.redraw();
  }

  // =====================================================
  // ZOOM
  // =====================================================

  private changeZoom(
    amount: number
  ) {
    const current =
      this.cameras.main.zoom;

    const next =
      Phaser.Math.Clamp(
        current + amount,
        0.15,
        1.5
      );

    this.cameras.main.setZoom(
      next
    );
  }

  // =====================================================
  // REDRAW
  // =====================================================

  private redraw() {
    if (!this.graphics) {
      return;
    }

    this.graphics.clear();

    for (
      let i = 0;
      i < this.boxes.length;
      i++
    ) {
      const box =
        this.boxes[i];

      const x =
        box.x *
        this.MAP_WIDTH;

      const y =
        box.y *
        this.MAP_HEIGHT;

      const width =
        box.width *
        this.MAP_WIDTH;

      const height =
        box.height *
        this.MAP_HEIGHT;

      const selected =
        i ===
        this.selectedBox;

      this.graphics.fillStyle(
        selected
          ? 0xffff00
          : 0xff0000,
        0.30
      );

      this.graphics.lineStyle(
        selected
          ? 5
          : 3,
        selected
          ? 0xffff00
          : 0xff0000,
        1
      );

      this.graphics.fillRect(
        x,
        y,
        width,
        height
      );

      this.graphics.strokeRect(
        x,
        y,
        width,
        height
      );
    }

    if (this.boxText) {
      this.boxText.setText(
        `Boxes: ${this.boxes.length}`
      );
    }
  }

  // =====================================================
  // SAVE
  // =====================================================

  private saveBoxes() {
    const data = {
      mapWidth:
        this.MAP_WIDTH,

      mapHeight:
        this.MAP_HEIGHT,

      coordinateMode:
        "normalized",

      boxes:
        this.boxes,
    };

    localStorage.setItem(
      "hunting_collisions",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    this.boxText.setText(
      `Boxes: ${this.boxes.length} | SAVED`
    );
  }

  // =====================================================
  // EXPORT
  // =====================================================

  private exportBoxes() {
    const data = {
      mapWidth:
        this.MAP_WIDTH,

      mapHeight:
        this.MAP_HEIGHT,

      coordinateMode:
        "normalized",

      boxes:
        this.boxes,
    };

    const json =
      JSON.stringify(
        data,
        null,
        2
      );

    const blob =
      new Blob(
        [json],
        {
          type:
            "application/json",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      "hunting_collisions.json";

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );

    this.boxText.setText(
      `Boxes: ${this.boxes.length} | EXPORTED`
    );
  }
}