import Phaser from "phaser";

type CollisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DungeonCollisionData = {
  sourceWidth: number;
  sourceHeight: number;
  worldScale: number;
  cellSize: number;
  boxes: CollisionBox[];
};

enum Direction {
  Down = "down",
  Up = "up",
  Left = "left",
  Right = "right",
}

export default class DungeonScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Record<
    "w" | "a" | "s" | "d" | "up" | "left" | "down" | "right",
    Phaser.Input.Keyboard.Key
  >;
  private exitKey!: Phaser.Input.Keyboard.Key;
  private currentDirection: Direction = Direction.Down;

  private readonly PLAYER_SPEED = 180;
  private readonly PLAYER_WIDTH = 93;
  private readonly PLAYER_HEIGHT = 124;

  private worldWidth = 2508;
  private worldHeight = 2508;

  // Entrance position taken from the generated Dungeon II map.
  private readonly ENTRANCE_X = 440;
  private readonly ENTRANCE_Y = 1020;
  private readonly EXIT_DISTANCE = 150;

  constructor() {
    super("DungeonScene");
  }

  preload() {
    // Put the generated PNG at assets/maps/dungeon2_map.png.
    this.load.image("dungeon2Map", "./assets/maps/dungeon2_map.png");
    this.load.json("dungeon2Collisions", "./assets/data/dungeon2_collisions.json");

    for (let i = 1; i <= 4; i++) {
      this.load.image(`d2_char_down_${i}`, `./assets/sprites/player/char_down_${i}.png`);
      this.load.image(`d2_char_up_${i}`, `./assets/sprites/player/char_up_${i}.png`);
      this.load.image(`d2_char_left_${i}`, `./assets/sprites/player/char_left_${i}.png`);
      this.load.image(`d2_char_right_${i}`, `./assets/sprites/player/char_right_${i}.png`);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor("#050609");

    const collisionData = this.cache.json.get("dungeon2Collisions") as DungeonCollisionData | null;
    if (collisionData) {
      this.worldWidth = collisionData.sourceWidth * collisionData.worldScale;
      this.worldHeight = collisionData.sourceHeight * collisionData.worldScale;
    }

    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Use the generated Dungeon II PNG when it is present. Keep a fallback so the
    // scene still opens while the PNG is being copied into assets/maps.
    if (this.textures.exists("dungeon2Map")) {
      const map = this.add.image(0, 0, "dungeon2Map").setOrigin(0, 0);
      map.setDisplaySize(this.worldWidth, this.worldHeight);
      map.setDepth(0);
    } else {
      const fallback = this.add.rectangle(
        this.worldWidth / 2,
        this.worldHeight / 2,
        this.worldWidth,
        this.worldHeight,
        0x090711,
        1
      );
      fallback.setDepth(0);

      this.add
        .text(this.worldWidth / 2, 180, "DUNGEON II", {
          fontFamily: "Georgia",
          fontSize: "52px",
          fontStyle: "bold",
          color: "#f5d76e",
          stroke: "#000000",
          strokeThickness: 7,
        })
        .setOrigin(0.5)
        .setDepth(1);
    }

    // These boxes were generated automatically from the PNG. Dark cave walls,
    // outside void, and blue water were classified as blocked areas; bridges and
    // walkable floor remain open.
    this.walls = this.physics.add.staticGroup();
    for (const box of collisionData?.boxes ?? []) {
      const wall = this.walls.create(box.x, box.y, undefined) as Phaser.Physics.Arcade.Image;
      wall.setVisible(false);
      wall.setDisplaySize(box.width, box.height);
      wall.refreshBody();
    }

    this.createAnimations();

    this.player = this.physics.add.sprite(this.ENTRANCE_X, this.ENTRANCE_Y, "d2_char_right_1");
    this.player.setDisplaySize(this.PLAYER_WIDTH, this.PLAYER_HEIGHT);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(20);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.PLAYER_WIDTH * 0.5, this.PLAYER_HEIGHT * 0.46);
    body.setOffset(this.PLAYER_WIDTH * 0.25, this.PLAYER_HEIGHT * 0.48);

    this.physics.add.collider(this.player, this.walls);

    const entranceHint = this.add.text(
      this.ENTRANCE_X - 20,
      this.ENTRANCE_Y + 90,
      "X TO RETURN",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 5,
      }
    );
    entranceHint.setOrigin(0.5);
    entranceHint.setDepth(30);

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
    keyboard.resetKeys();

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
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.ENTRANCE_X,
        this.ENTRANCE_Y
      ) <= this.EXIT_DISTANCE
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
