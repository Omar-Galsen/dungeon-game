import Phaser from "phaser";

enum Direction {
  Down = "down",
  Up = "up",
  Left = "left",
  Right = "right",
}

export default class DungeonScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Record<
    "w" | "a" | "s" | "d" | "up" | "left" | "down" | "right",
    Phaser.Input.Keyboard.Key
  >;
  private exitKey!: Phaser.Input.Keyboard.Key;
  private currentDirection: Direction = Direction.Down;
  private readonly PLAYER_SPEED = 180;
  private readonly PLAYER_WIDTH = 93;
  private readonly PLAYER_HEIGHT = 124;

  constructor() {
    super("DungeonScene");
  }

  preload() {
    for (let i = 1; i <= 4; i++) {
      this.load.image(`d2_char_down_${i}`, `./assets/sprites/player/char_down_${i}.png`);
      this.load.image(`d2_char_up_${i}`, `./assets/sprites/player/char_up_${i}.png`);
      this.load.image(`d2_char_left_${i}`, `./assets/sprites/player/char_left_${i}.png`);
      this.load.image(`d2_char_right_${i}`, `./assets/sprites/player/char_right_${i}.png`);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor("#090711");
    this.physics.world.setBounds(0, 0, 1600, 1100);
    this.cameras.main.setBounds(0, 0, 1600, 1100);

    const floor = this.add.rectangle(800, 550, 1500, 1000, 0x171126, 1);
    floor.setStrokeStyle(10, 0x312e81, 1);

    for (let x = 140; x <= 1460; x += 120) {
      for (let y = 130; y <= 970; y += 120) {
        const tile = this.add.rectangle(x, y, 105, 105, 0x211a35, 0.55);
        tile.setStrokeStyle(1, 0x4338ca, 0.25);
      }
    }

    const entranceGlow = this.add.circle(800, 920, 75, 0x6d28d9, 0.28);
    this.tweens.add({
      targets: entranceGlow,
      alpha: 0.65,
      scale: 1.16,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    const title = this.add.text(800, 120, "DUNGEON II", {
      fontFamily: "Georgia",
      fontSize: "48px",
      fontStyle: "bold",
      color: "#f5d76e",
      stroke: "#000000",
      strokeThickness: 7,
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(800, 185, "The deeper dungeon has been unlocked.", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ddd6fe",
    });
    subtitle.setOrigin(0.5);

    const hint = this.add.text(800, 970, "Press X near the entrance to return to the hunting grounds", {
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    });
    hint.setOrigin(0.5);

    this.createAnimations();

    this.player = this.physics.add.sprite(800, 820, "d2_char_down_1");
    this.player.setDisplaySize(this.PLAYER_WIDTH, this.PLAYER_HEIGHT);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(20);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable.");

    this.cursors = {
      w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };
    this.exitKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  update() {
    let dx = 0;
    let dy = 0;

    if (this.cursors.w.isDown || this.cursors.up.isDown) {
      dy = -1;
      this.currentDirection = Direction.Up;
    }
    if (this.cursors.s.isDown || this.cursors.down.isDown) {
      dy = 1;
      this.currentDirection = Direction.Down;
    }
    if (this.cursors.a.isDown || this.cursors.left.isDown) {
      dx = -1;
      this.currentDirection = Direction.Left;
    }
    if (this.cursors.d.isDown || this.cursors.right.isDown) {
      dx = 1;
      this.currentDirection = Direction.Right;
    }

    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    this.player.setVelocity(dx * this.PLAYER_SPEED, dy * this.PLAYER_SPEED);

    if (dx !== 0 || dy !== 0) {
      this.player.play(`d2_walk_${this.currentDirection}`, true);
    } else {
      this.player.anims.stop();
      this.player.setTexture(`d2_char_${this.currentDirection}_1`);
    }
    this.player.setDisplaySize(this.PLAYER_WIDTH, this.PLAYER_HEIGHT);

    if (
      Phaser.Input.Keyboard.JustDown(this.exitKey) &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, 800, 920) <= 130
    ) {
      this.scene.start("HuntScene");
    }
  }

  private createAnimations() {
    for (const direction of ["down", "up", "left", "right"]) {
      const key = `d2_walk_${direction}`;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [1, 2, 3, 4].map((i) => ({ key: `d2_char_${direction}_${i}` })),
          frameRate: 12,
          repeat: -1,
        });
      }
    }
  }
}
