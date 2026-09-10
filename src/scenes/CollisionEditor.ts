import Phaser from "phaser";

type CollisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default class CollisionEditor extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private graphics!: Phaser.GameObjects.Graphics;
  private boxCounter!: Phaser.GameObjects.Text;

  private boxes: CollisionBox[] = [];

  private mapX = 0;
  private mapY = 0;
  private mapWidth = 0;
  private mapHeight = 0;

  private drawing = false;
  private startX = 0;
  private startY = 0;

  private selectedBox: number | null = null;

  constructor() {
    super("CollisionEditor");
  }

  preload() {
    this.load.image(
      "background",
      "/assets/maps/background.png"
    );
  }

  create() {
    // MAP
    this.background = this.add.image(
      this.scale.width / 2,
      this.scale.height / 2,
      "background"
    );

    // Fit map inside game window
    const maxWidth = this.scale.width - 40;
    const maxHeight = this.scale.height - 80;

    const source = this.background.texture.getSourceImage();

    const scaleX = maxWidth / source.width;
    const scaleY = maxHeight / source.height;

    const scale = Math.min(scaleX, scaleY);

    this.background.setScale(scale);

    this.mapWidth = this.background.displayWidth;
    this.mapHeight = this.background.displayHeight;

    this.mapX =
      this.background.x - this.mapWidth / 2;

    this.mapY =
      this.background.y - this.mapHeight / 2;

    // Collision graphics
    this.graphics = this.add.graphics();

    // Instructions
    this.add.text(
      10,
      10,
      "DRAW: drag mouse | CLICK: select | DELETE: remove | C: clear | S: save | E: export",
      {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: {
          x: 8,
          y: 6,
        },
      }
    ).setDepth(100);

    // Box counter
    this.boxCounter = this.add.text(
      10,
      50,
      "Boxes: 0",
      {
        fontSize: "18px",
        color: "#00ff00",
        backgroundColor: "#000000",
        padding: {
          x: 8,
          y: 6,
        },
      }
    ).setDepth(100);

    // Mouse controls
    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        if (
          this.selectBox(
            pointer.x,
            pointer.y
          )
        ) {
          return;
        }

        this.startDrawing(pointer);
      }
    );

    this.input.on(
      "pointermove",
      (pointer: Phaser.Input.Pointer) => {
        this.drawPreview(pointer);
      }
    );

    this.input.on(
      "pointerup",
      (pointer: Phaser.Input.Pointer) => {
        this.finishDrawing(pointer);
      }
    );

    // Keyboard controls
    this.input.keyboard?.on(
      "keydown-DELETE",
      () => {
        this.deleteSelected();
      }
    );

    this.input.keyboard?.on(
      "keydown-C",
      () => {
        this.clearBoxes();
      }
    );

    this.input.keyboard?.on(
      "keydown-S",
      () => {
        this.saveBoxes();
      }
    );

    this.input.keyboard?.on(
      "keydown-E",
      () => {
        this.exportBoxes();
      }
    );

    this.drawBoxes();
  }

  // Start drawing a collision box
  private startDrawing(
    pointer: Phaser.Input.Pointer
  ) {
    if (
      !this.isInsideMap(
        pointer.x,
        pointer.y
      )
    ) {
      return;
    }

    this.drawing = true;

    this.startX = Phaser.Math.Clamp(
      pointer.x,
      this.mapX,
      this.mapX + this.mapWidth
    );

    this.startY = Phaser.Math.Clamp(
      pointer.y,
      this.mapY,
      this.mapY + this.mapHeight
    );
  }

  // Show box while dragging
  private drawPreview(
    pointer: Phaser.Input.Pointer
  ) {
    if (!this.drawing) {
      return;
    }

    const currentX = Phaser.Math.Clamp(
      pointer.x,
      this.mapX,
      this.mapX + this.mapWidth
    );

    const currentY = Phaser.Math.Clamp(
      pointer.y,
      this.mapY,
      this.mapY + this.mapHeight
    );

    this.graphics.clear();

    this.drawBoxes();

    const x = Math.min(
      this.startX,
      currentX
    );

    const y = Math.min(
      this.startY,
      currentY
    );

    const width = Math.abs(
      currentX - this.startX
    );

    const height = Math.abs(
      currentY - this.startY
    );

    this.graphics.lineStyle(
      2,
      0xff0000,
      1
    );

    this.graphics.strokeRect(
      x,
      y,
      width,
      height
    );
  }

  // Finish drawing
  private finishDrawing(
    pointer: Phaser.Input.Pointer
  ) {
    if (!this.drawing) {
      return;
    }

    this.drawing = false;

    const endX = Phaser.Math.Clamp(
      pointer.x,
      this.mapX,
      this.mapX + this.mapWidth
    );

    const endY = Phaser.Math.Clamp(
      pointer.y,
      this.mapY,
      this.mapY + this.mapHeight
    );

    const screenX = Math.min(
      this.startX,
      endX
    );

    const screenY = Math.min(
      this.startY,
      endY
    );

    const screenWidth = Math.abs(
      endX - this.startX
    );

    const screenHeight = Math.abs(
      endY - this.startY
    );

    // Ignore tiny boxes
    if (
      screenWidth < 5 ||
      screenHeight < 5
    ) {
      this.drawBoxes();
      return;
    }

    // Convert screen coordinates
    // into normalized map coordinates
    const normalizedBox: CollisionBox = {
      x:
        (screenX - this.mapX) /
        this.mapWidth,

      y:
        (screenY - this.mapY) /
        this.mapHeight,

      width:
        screenWidth /
        this.mapWidth,

      height:
        screenHeight /
        this.mapHeight,
    };

    this.boxes.push(normalizedBox);

    this.updateBoxCounter();
    this.drawBoxes();
  }

  // Draw every collision box
  private drawBoxes() {
    if (!this.graphics) {
      return;
    }

    this.graphics.clear();

    this.boxes.forEach(
      (box, index) => {
        const x =
          this.mapX +
          box.x * this.mapWidth;

        const y =
          this.mapY +
          box.y * this.mapHeight;

        const width =
          box.width *
          this.mapWidth;

        const height =
          box.height *
          this.mapHeight;

        if (
          index === this.selectedBox
        ) {
          this.graphics.lineStyle(
            3,
            0xffff00,
            1
          );
        } else {
          this.graphics.lineStyle(
            2,
            0xff0000,
            1
          );
        }

        this.graphics.strokeRect(
          x,
          y,
          width,
          height
        );
      }
    );
  }

  // Select a box by clicking it
  private selectBox(
    pointerX: number,
    pointerY: number
  ): boolean {
    for (
      let i = this.boxes.length - 1;
      i >= 0;
      i--
    ) {
      const box = this.boxes[i];

      const x =
        this.mapX +
        box.x * this.mapWidth;

      const y =
        this.mapY +
        box.y * this.mapHeight;

      const width =
        box.width *
        this.mapWidth;

      const height =
        box.height *
        this.mapHeight;

      if (
        pointerX >= x &&
        pointerX <= x + width &&
        pointerY >= y &&
        pointerY <= y + height
      ) {
        this.selectedBox = i;

        this.drawBoxes();

        return true;
      }
    }

    this.selectedBox = null;
    this.drawBoxes();

    return false;
  }

  // Delete selected box
  private deleteSelected() {
    if (
      this.selectedBox === null
    ) {
      return;
    }

    this.boxes.splice(
      this.selectedBox,
      1
    );

    this.selectedBox = null;

    this.updateBoxCounter();
    this.drawBoxes();
  }

  // Clear all boxes
  private clearBoxes() {
    this.boxes = [];
    this.selectedBox = null;

    this.updateBoxCounter();
    this.drawBoxes();
  }

  // Update counter
  private updateBoxCounter() {
    this.boxCounter.setText(
      `Boxes: ${this.boxes.length}`
    );
  }

  // Save to browser storage
  private saveBoxes() {
    localStorage.setItem(
      "dungeonCollisions",
      JSON.stringify({
        mapWidth: this.mapWidth,
        mapHeight: this.mapHeight,
        coordinateMode: "normalized",
        boxes: this.boxes,
      })
    );

    console.log(
      `Saved ${this.boxes.length} collision boxes.`
    );
  }

  // Export JSON file
  private exportBoxes() {
    const data = {
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      coordinateMode: "normalized",
      boxes: this.boxes,
    };

    const blob = new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        ),
      ],
      {
        type: "application/json",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = "collisions.json";

    link.click();

    URL.revokeObjectURL(url);
  }

  // Check if mouse is inside map
  private isInsideMap(
    x: number,
    y: number
  ): boolean {
    return (
      x >= this.mapX &&
      x <= this.mapX + this.mapWidth &&
      y >= this.mapY &&
      y <= this.mapY + this.mapHeight
    );
  }
}