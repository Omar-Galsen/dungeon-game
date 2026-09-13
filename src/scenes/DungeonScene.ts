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

type AcidSlime = {
  sprite: Phaser.Physics.Arcade.Sprite;
  nextShotAt: number;
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
  private acidProjectiles!: Phaser.Physics.Arcade.Group;
  private acidSlimes: AcidSlime[] = [];

  private cursors!: Record<
    "w" | "a" | "s" | "d" | "up" | "left" | "down" | "right",
    Phaser.Input.Keyboard.Key
  >;
  private exitKey!: Phaser.Input.Keyboard.Key;
  private currentDirection: Direction = Direction.Down;

  private readonly PLAYER_SPEED = 180;
  private readonly PLAYER_WIDTH = 93;
  private readonly PLAYER_HEIGHT = 124;
  private readonly ACID_RANGE = 680;
  private readonly ACID_SPEED = 250;
  private readonly ACID_DAMAGE = 10;

  private playerHealth = 100;
  private healthText!: Phaser.GameObjects.Text;

  private worldWidth = 2508;
  private worldHeight = 2508;

  private readonly ENTRANCE_X = 440;
  private readonly ENTRANCE_Y = 1020;
  private readonly EXIT_DISTANCE = 150;

  private readonly CENTRAL_BRIDGE_CLEAR_ZONE = {
    left: 1010,
    right: 1290,
    top: 980,
    bottom: 1210,
  } as const;

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
      this.load.image(`d2_acid_slime_${i}`, `./assets/sprites/slimes/idle/slime_idle_${i}.png`);
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

    this.walls = this.physics.add.staticGroup();
    for (const box of collisionData?.boxes ?? []) {
      if (this.shouldClearWalkableAccessCollision(box)) continue;
      const wall = this.walls.create(box.x, box.y, undefined) as Phaser.Physics.Arcade.Image;
      wall.setVisible(false);
      wall.setDisplaySize(box.width, box.height);
      wall.refreshBody();
    }

    this.createAnimations();
    this.createAcidTexture();

    const savedHealth = this.registry.get("playerHealth");
    this.playerHealth = typeof savedHealth === "number" ? savedHealth : 100;

    this.player = this.physics.add.sprite(this.ENTRANCE_X, this.ENTRANCE_Y, "d2_char_right_1");
    this.player.setDisplaySize(this.PLAYER_WIDTH, this.PLAYER_HEIGHT);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(20);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.PLAYER_WIDTH * 0.5, this.PLAYER_HEIGHT * 0.46);
    body.setOffset(this.PLAYER_WIDTH * 0.25, this.PLAYER_HEIGHT * 0.48);

    this.physics.add.collider(this.player, this.walls);

    this.createAcidSlimes();
    this.acidProjectiles = this.physics.add.group({ allowGravity: false });

    this.physics.add.collider(this.acidProjectiles, this.walls, (projectile) => {
      (projectile as Phaser.Physics.Arcade.Image).destroy();
    });

    this.physics.add.overlap(this.player, this.acidProjectiles, (_player, projectile) => {
      (projectile as Phaser.Physics.Arcade.Image).destroy();
      this.damagePlayerFromAcid();
    });

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

    this.healthText = this.add.text(18, 18, `HP: ${this.playerHealth}/100`, {
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 5,
      backgroundColor: "#111827",
      padding: { x: 10, y: 6 },
    });
    this.healthText.setScrollFactor(0);
    this.healthText.setDepth(1000);

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

  update(time: number) {
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
    this.updateAcidSlimes(time);
    this.cleanupAcidProjectiles();

    if (
      Phaser.Input.Keyboard.JustDown(this.exitKey) &&
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.ENTRANCE_X,
        this.ENTRANCE_Y
      ) <= this.EXIT_DISTANCE
    ) {
      this.registry.set("playerHealth", this.playerHealth);
      this.scene.start("HuntScene");
    }
  }

  private createAcidSlimes() {
    const spawnPoints = [
      { x: 650, y: 560 },
      { x: 1540, y: 470 },
      { x: 1440, y: 1120 },
      { x: 560, y: 1480 },
      { x: 1130, y: 1830 },
      { x: 1810, y: 1450 },
      { x: 2100, y: 1840 },
    ];

    this.acidSlimes = spawnPoints.map((point, index) => {
      const sprite = this.physics.add.sprite(point.x, point.y, "d2_acid_slime_1");
      sprite.setDisplaySize(68, 58);
      sprite.setTint(0x55ff66);
      sprite.setDepth(18);
      sprite.setImmovable(true);
      sprite.play("d2_acid_slime_idle");
      this.physics.add.collider(sprite, this.walls);

      this.tweens.add({
        targets: sprite,
        y: point.y - 8,
        duration: 700 + index * 60,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      return {
        sprite,
        nextShotAt: 900 + index * 240,
      };
    });
  }

  private updateAcidSlimes(time: number) {
    for (const slime of this.acidSlimes) {
      if (!slime.sprite.active) continue;

      const distance = Phaser.Math.Distance.Between(
        slime.sprite.x,
        slime.sprite.y,
        this.player.x,
        this.player.y
      );

      if (distance > this.ACID_RANGE || time < slime.nextShotAt) continue;

      this.spitAcid(slime.sprite);
      slime.nextShotAt = time + Phaser.Math.Between(1500, 2200);
    }
  }

  private spitAcid(slime: Phaser.Physics.Arcade.Sprite) {
    const acid = this.acidProjectiles.create(slime.x, slime.y, "d2_acid_blob") as Phaser.Physics.Arcade.Image;
    acid.setDisplaySize(24, 24);
    acid.setDepth(25);
    acid.setBlendMode(Phaser.BlendModes.ADD);

    const angle = Phaser.Math.Angle.Between(slime.x, slime.y, this.player.x, this.player.y);
    this.physics.velocityFromRotation(angle, this.ACID_SPEED, acid.body.velocity);

    this.tweens.add({
      targets: acid,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 160,
      yoyo: true,
      repeat: -1,
    });
  }

  private createAcidTexture() {
    if (this.textures.exists("d2_acid_blob")) return;

    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x9cff57, 1);
    graphics.fillCircle(12, 12, 10);
    graphics.fillStyle(0xeaff9d, 0.9);
    graphics.fillCircle(9, 8, 4);
    graphics.generateTexture("d2_acid_blob", 24, 24);
    graphics.destroy();
  }

  private damagePlayerFromAcid() {
    this.playerHealth = Math.max(0, this.playerHealth - this.ACID_DAMAGE);
    this.registry.set("playerHealth", this.playerHealth);
    this.healthText.setText(`HP: ${this.playerHealth}/100`);

    this.player.setTint(0xa8ff84);
    this.time.delayedCall(160, () => this.player.clearTint());

    if (this.playerHealth > 0) return;

    this.player.setVelocity(0, 0);
    this.playerHealth = 100;
    this.registry.set("playerHealth", 100);
    this.time.delayedCall(250, () => {
      this.scene.restart();
    });
  }

  private cleanupAcidProjectiles() {
    for (const child of this.acidProjectiles.getChildren()) {
      const acid = child as Phaser.Physics.Arcade.Image;
      if (
        acid.x < -50 ||
        acid.y < -50 ||
        acid.x > this.worldWidth + 50 ||
        acid.y > this.worldHeight + 50
      ) {
        acid.destroy();
      }
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

    return right > zone.left && left < zone.right && bottom > zone.top && top < zone.bottom;
  }

  private shouldClearWalkableAccessCollision(box: CollisionBox) {
    const onCentralBridge = this.boxOverlapsZone(box, this.CENTRAL_BRIDGE_CLEAR_ZONE);
    const onBossStairs = this.boxOverlapsZone(box, this.BOSS_STAIRS_CLEAR_ZONE);

    if (!onCentralBridge && !onBossStairs) return false;
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

    if (!this.anims.exists("d2_acid_slime_idle")) {
      this.anims.create({
        key: "d2_acid_slime_idle",
        frames: [1, 2, 3, 4].map((i) => ({ key: `d2_acid_slime_${i}` })),
        frameRate: 8,
        repeat: -1,
      });
    }
  }
}
