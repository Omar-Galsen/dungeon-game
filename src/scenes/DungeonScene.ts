import Phaser from "phaser";

type CollisionBox = { x: number; y: number; width: number; height: number };
type DungeonCollisionData = { sourceWidth: number; sourceHeight: number; worldScale: number; cellSize: number; boxes: CollisionBox[] };
type AcidSlime = { sprite: Phaser.Physics.Arcade.Sprite; nextShotAt: number; hp: number };

enum Direction { Down = "down", Up = "up", Left = "left", Right = "right" }

export default class DungeonScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private acidProjectiles!: Phaser.Physics.Arcade.Group;
  private acidSlimes: AcidSlime[] = [];
  private cursors!: Record<"w" | "a" | "s" | "d" | "up" | "left" | "down" | "right", Phaser.Input.Keyboard.Key>;
  private exitKey!: Phaser.Input.Keyboard.Key;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private currentDirection: Direction = Direction.Right;
  private swordAttackPlaying = false;
  private attackCooldown = 0;

  private readonly PLAYER_SPEED = 180;
  private readonly SWORD_WIDTH = 108;
  private readonly SWORD_HEIGHT = 144;
  private readonly SWORD_ATTACK_WIDTH = 135;
  private readonly SWORD_ATTACK_HEIGHT = 180;
  private readonly ACID_RANGE = 680;
  private readonly ACID_SPEED = 250;
  private readonly ACID_DAMAGE = 10;
  private readonly SWORD_DAMAGE = 10;
  private readonly SWORD_RANGE = 125;

  private playerHealth = 100;
  private healthText!: Phaser.GameObjects.Text;
  private worldWidth = 2508;
  private worldHeight = 2508;

  private readonly ENTRANCE_X = 440;
  private readonly ENTRANCE_Y = 1020;
  private readonly EXIT_DISTANCE = 150;

  private readonly CENTRAL_BRIDGE_CLEAR_ZONE = { left: 1010, right: 1290, top: 980, bottom: 1210 } as const;
  private readonly BOSS_STAIRS_CLEAR_ZONE = { left: 2070, right: 2305, top: 1010, bottom: 1435 } as const;

  constructor() { super("DungeonScene"); }

  preload() {
    this.load.image("dungeon2Map", "./assets/maps/Dungeon 2 Cavern Map.png");
    this.load.json("dungeon2Collisions", "./assets/data/dungeon2_collisions.json");

    for (let i = 1; i <= 8; i++) {
      this.load.image(`d2_sword_idle_down_${i}`, `./assets/sprites/sword/idle/sword_idle_down_${i}.png`);
      this.load.image(`d2_sword_idle_up_${i}`, `./assets/sprites/sword/idle/sword_idle_up_${i}.png`);
      this.load.image(`d2_sword_idle_left_${i}`, `./assets/sprites/sword/idle/sword_idle_left_${i}.png`);
      this.load.image(`d2_sword_idle_right_${i}`, `./assets/sprites/sword/idle/sword_idle_right_${i}.png`);

      this.load.image(`d2_sword_walk_down_${i}`, `./assets/sprites/sword/walk/sword_walk_down_${i}.png`);
      this.load.image(`d2_sword_walk_up_${i}`, `./assets/sprites/sword/walk/sword_walk_up_${i}.png`);
      this.load.image(`d2_sword_walk_left_${i}`, `./assets/sprites/sword/walk/sword_walk_left_${i}.png`);
      this.load.image(`d2_sword_walk_right_${i}`, `./assets/sprites/sword/walk/sword_walk_right_${i}.png`);

      this.load.image(`d2_sword_attack_down_${i}`, `./assets/sprites/sword/attack/sword_attack_down_${i}.png`);
      this.load.image(`d2_sword_attack_up_${i}`, `./assets/sprites/sword/attack/sword_attack_up_${i}.png`);
      this.load.image(`d2_sword_attack_left_${i}`, `./assets/sprites/sword/attack/sword_attack_left_${i}.png`);
      this.load.image(`d2_sword_attack_right_${i}`, `./assets/sprites/sword/attack/sword_attack_right_${i}.png`);
    }

    for (let i = 1; i <= 4; i++) {
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

    this.add.image(0, 0, "dungeon2Map").setOrigin(0, 0).setDisplaySize(this.worldWidth, this.worldHeight).setDepth(0);

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

    this.player = this.physics.add.sprite(this.ENTRANCE_X, this.ENTRANCE_Y, "d2_sword_idle_right_1");
    this.player.setDisplaySize(this.SWORD_WIDTH, this.SWORD_HEIGHT);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(20);
    this.updatePlayerBody();
    this.physics.add.collider(this.player, this.walls);
    this.player.play("d2_sword_idle_right", true);

    this.createAcidSlimes();
    this.acidProjectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.collider(this.acidProjectiles, this.walls, (projectile) => (projectile as Phaser.Physics.Arcade.Image).destroy());
    this.physics.add.overlap(this.player, this.acidProjectiles, (_player, projectile) => {
      (projectile as Phaser.Physics.Arcade.Image).destroy();
      this.damagePlayerFromAcid();
    });

    const entranceHint = this.add.text(this.ENTRANCE_X - 20, this.ENTRANCE_Y + 90, "X TO RETURN", {
      fontFamily: "Arial", fontSize: "18px", fontStyle: "bold", color: "#ffffff", stroke: "#000000", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(30);

    this.healthText = this.add.text(18, 18, `HP: ${this.playerHealth}/100   J: SWORD ATTACK`, {
      fontFamily: "Arial", fontSize: "20px", fontStyle: "bold", color: "#ffffff", stroke: "#000000", strokeThickness: 5,
      backgroundColor: "#111827", padding: { x: 10, y: 6 },
    });
    this.healthText.setScrollFactor(0).setDepth(1000);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable.");
    this.cursors = {
      w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W), a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S), d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP), left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN), right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };
    this.exitKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.attackKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    keyboard.resetKeys();
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  update(time: number, delta: number) {
    this.attackCooldown -= delta;
    let dx = 0, dy = 0;

    if (!this.swordAttackPlaying) {
      if (this.cursors.w.isDown || this.cursors.up.isDown) { dy = -1; this.currentDirection = Direction.Up; }
      if (this.cursors.s.isDown || this.cursors.down.isDown) { dy = 1; this.currentDirection = Direction.Down; }
      if (this.cursors.a.isDown || this.cursors.left.isDown) { dx = -1; this.currentDirection = Direction.Left; }
      if (this.cursors.d.isDown || this.cursors.right.isDown) { dx = 1; this.currentDirection = Direction.Right; }
      if (dx !== 0 && dy !== 0) { const length = Math.sqrt(dx * dx + dy * dy); dx /= length; dy /= length; }
      this.player.setVelocity(dx * this.PLAYER_SPEED, dy * this.PLAYER_SPEED);

      if (dx !== 0 || dy !== 0) {
        this.player.play(`d2_sword_walk_${this.currentDirection}`, true);
        this.player.setDisplaySize(this.SWORD_WIDTH, this.SWORD_HEIGHT);
      } else {
        this.player.play(`d2_sword_idle_${this.currentDirection}`, true);
        this.player.setDisplaySize(this.SWORD_WIDTH, this.SWORD_HEIGHT);
      }
      this.updatePlayerBody();
    }

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this.swordAttack();

    this.updateAcidSlimes(time);
    this.cleanupAcidProjectiles();

    if (Phaser.Input.Keyboard.JustDown(this.exitKey) && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ENTRANCE_X, this.ENTRANCE_Y) <= this.EXIT_DISTANCE) {
      this.registry.set("playerHealth", this.playerHealth);
      this.scene.start("HuntScene");
    }
  }

  private swordAttack() {
    if (this.swordAttackPlaying || this.attackCooldown > 0) return;
    this.swordAttackPlaying = true;
    this.attackCooldown = 360;
    this.player.setVelocity(0, 0);
    this.player.play(`d2_sword_attack_${this.currentDirection}`, true);
    this.player.setDisplaySize(this.SWORD_ATTACK_WIDTH, this.SWORD_ATTACK_HEIGHT);
    this.updatePlayerBody();

    const target = this.acidSlimes
      .filter((slime) => slime.sprite.active && slime.hp > 0)
      .map((slime) => ({ slime, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, slime.sprite.x, slime.sprite.y) }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (target && target.distance <= this.SWORD_RANGE) {
      target.slime.hp -= this.SWORD_DAMAGE;
      target.slime.sprite.setTint(0xffffff);
      this.time.delayedCall(90, () => target.slime.sprite.active && target.slime.sprite.setTint(0x55ff66));
      if (target.slime.hp <= 0) {
        target.slime.sprite.disableBody(true, true);
      }
    }

    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.swordAttackPlaying = false;
      this.player.play(`d2_sword_idle_${this.currentDirection}`, true);
      this.player.setDisplaySize(this.SWORD_WIDTH, this.SWORD_HEIGHT);
      this.updatePlayerBody();
    });
  }

  private updatePlayerBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.SWORD_WIDTH * 0.5, this.SWORD_HEIGHT * 0.46);
    body.setOffset((this.player.displayWidth - this.SWORD_WIDTH * 0.5) / 2, this.player.displayHeight * 0.46);
  }

  private createAcidSlimes() {
    const spawnPoints = [
      { x: 650, y: 560 }, { x: 1540, y: 470 }, { x: 1440, y: 1120 },
      { x: 560, y: 1480 }, { x: 1130, y: 1830 }, { x: 1810, y: 1450 }, { x: 2100, y: 1840 },
    ];
    this.acidSlimes = spawnPoints.map((point, index) => {
      const sprite = this.physics.add.sprite(point.x, point.y, "d2_acid_slime_1");
      sprite.setDisplaySize(68, 58).setTint(0x55ff66).setDepth(18).setImmovable(true);
      sprite.play("d2_acid_slime_idle");
      this.physics.add.collider(sprite, this.walls);
      this.tweens.add({ targets: sprite, y: point.y - 8, duration: 700 + index * 60, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      return { sprite, nextShotAt: 900 + index * 240, hp: 30 };
    });
  }

  private updateAcidSlimes(time: number) {
    for (const slime of this.acidSlimes) {
      if (!slime.sprite.active || slime.hp <= 0) continue;
      const distance = Phaser.Math.Distance.Between(slime.sprite.x, slime.sprite.y, this.player.x, this.player.y);
      if (distance > this.ACID_RANGE || time < slime.nextShotAt) continue;
      this.spitAcid(slime.sprite);
      slime.nextShotAt = time + Phaser.Math.Between(1500, 2200);
    }
  }

  private spitAcid(slime: Phaser.Physics.Arcade.Sprite) {
    const acid = this.acidProjectiles.create(slime.x, slime.y, "d2_acid_blob") as Phaser.Physics.Arcade.Image;
    acid.setDisplaySize(24, 24).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
    const angle = Phaser.Math.Angle.Between(slime.x, slime.y, this.player.x, this.player.y);
    this.physics.velocityFromRotation(angle, this.ACID_SPEED, acid.body.velocity);
    this.tweens.add({ targets: acid, scaleX: 1.3, scaleY: 1.3, duration: 160, yoyo: true, repeat: -1 });
  }

  private createAcidTexture() {
    if (this.textures.exists("d2_acid_blob")) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x9cff57, 1); graphics.fillCircle(12, 12, 10);
    graphics.fillStyle(0xeaff9d, 0.9); graphics.fillCircle(9, 8, 4);
    graphics.generateTexture("d2_acid_blob", 24, 24); graphics.destroy();
  }

  private damagePlayerFromAcid() {
    this.playerHealth = Math.max(0, this.playerHealth - this.ACID_DAMAGE);
    this.registry.set("playerHealth", this.playerHealth);
    this.healthText.setText(`HP: ${this.playerHealth}/100   J: SWORD ATTACK`);
    this.player.setTint(0xa8ff84);
    this.time.delayedCall(160, () => this.player.clearTint());
    if (this.playerHealth > 0) return;
    this.player.setVelocity(0, 0);
    this.playerHealth = 100;
    this.registry.set("playerHealth", 100);
    this.time.delayedCall(250, () => this.scene.restart());
  }

  private cleanupAcidProjectiles() {
    for (const child of this.acidProjectiles.getChildren()) {
      const acid = child as Phaser.Physics.Arcade.Image;
      if (acid.x < -50 || acid.y < -50 || acid.x > this.worldWidth + 50 || acid.y > this.worldHeight + 50) acid.destroy();
    }
  }

  private boxOverlapsZone(box: CollisionBox, zone: { left: number; right: number; top: number; bottom: number }) {
    const left = box.x - box.width / 2, right = box.x + box.width / 2, top = box.y - box.height / 2, bottom = box.y + box.height / 2;
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
      const idleKey = `d2_sword_idle_${direction}`;
      if (!this.anims.exists(idleKey)) this.anims.create({ key: idleKey, frames: Array.from({ length: 8 }, (_, i) => ({ key: `d2_sword_idle_${direction}_${i + 1}` })), frameRate: 6, repeat: -1 });
      const walkKey = `d2_sword_walk_${direction}`;
      if (!this.anims.exists(walkKey)) this.anims.create({ key: walkKey, frames: Array.from({ length: 8 }, (_, i) => ({ key: `d2_sword_walk_${direction}_${i + 1}` })), frameRate: 12, repeat: -1 });
      const attackKey = `d2_sword_attack_${direction}`;
      if (!this.anims.exists(attackKey)) this.anims.create({ key: attackKey, frames: Array.from({ length: 8 }, (_, i) => ({ key: `d2_sword_attack_${direction}_${i + 1}` })), frameRate: 20, repeat: 0 });
    }

    if (!this.anims.exists("d2_acid_slime_idle")) {
      this.anims.create({ key: "d2_acid_slime_idle", frames: [1, 2, 3, 4].map((i) => ({ key: `d2_acid_slime_${i}` })), frameRate: 8, repeat: -1 });
    }
  }
}
