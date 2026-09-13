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

  private readonly ENTRANCE_X = 440;
  private readonly ENTRANCE_Y = 1020;
  private readonly EXIT_DISTANCE = 150;

  // Extra breathing room around the central bridge so the player can cross
  // without getting caught by small automatically generated edge blockers.
  private readonly CENTRAL_BRIDGE_CLEAR_ZONE = {
    left: 1010,
    right: 1290,
    top: 980,
    bottom: 1210,
  } as const;

  // Keep the full staircase/corridor to the purple boss room walkable.
  // This follows the stair path on the right side of the Dungeon II map.
  private readonly BOSS_STAIRS_CLEAR_ZONE = {
    left: 2070,
    right: 2305,
    top: 1010,
    bottom: 1435,
  } as const;

  constructor() {
    super("DungeonScene");
  }

  preload() {
    this.load.image("dungeon2Map", "./assets/maps/Dungeon 2 Cavern Map.png");
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

    const map = this.add.image(0, 0, "dungeon2Map").setOrigin(0, 0);
    map.setDisplaySize(this.worldWidth, this.worldHeight);
    map.setDepth(0);

    // Auto-generated collision covers the black void, cave walls and water.
    // Small edge blockers are removed only in explicitly walkable bridge/stair
    // areas so the player can still reach the purple boss-room stairs.
    this.walls = this.physics.add.staticGroup();
    for (const box of collisionData?.boxes ?? []) {
      if (this.shouldClearWalkableAccessCollision(box)) continue;

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

  private boxOverlapsZone(
    box: CollisionBox,
    zone: { left: number; right: number; top: number; bottom: number }
  ) {
    const left = box.x - box.width / 2;
    const right = box.x + box.width / 2;
    const top = box.y - box.height / 2;
    const bottom = box.y + box.height / 2;

    return (
      right > zone.left &&
      left < zone.right &&
      bottom > zone.top &&
      top < zone.bottom
    );
  }

  private shouldClearWalkableAccessCollision(box: CollisionBox) {
    const onCentralBridge = this.boxOverlapsZone(box, this.CENTRAL_BRIDGE_CLEAR_ZONE);
    const onBossStairs = this.boxOverlapsZone(box, this.BOSS_STAIRS_CLEAR_ZONE);

    if (!onCentralBridge && !onBossStairs) return false;

    // Only clear the small/medium auto-generated edge cells. Large wall and
    // void blockers remain solid so the player cannot walk through rock/black space.
    return box.width <= 320 && box.height <= 220;
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
