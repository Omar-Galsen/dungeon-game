import Phaser from "phaser";

type CollisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CollisionData = {
  mapWidth: number;
  mapHeight: number;
  coordinateMode: string;
  boxes: CollisionBox[];
};

type SlimeState = {
  id: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  alive: boolean;
  direction: number;
  minY: number;
  maxY: number;
  speed: number;
  hearts: Phaser.GameObjects.Image[];
};

enum Animation {
  Down = "down",
  Up = "up",
  Left = "left",
  Right = "right",
}

export default class HuntScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private slimes: SlimeState[] = [];

  private cursors!: Record<
    "w" | "a" | "s" | "d" | "up" | "left" | "down" | "right",
    Phaser.Input.Keyboard.Key
  >;

  private attackKey!: Phaser.Input.Keyboard.Key;
  private exitKey!: Phaser.Input.Keyboard.Key;
  private restartKey!: Phaser.Input.Keyboard.Key;

  private currentDirection: Animation = Animation.Down;

  private readonly PLAYER_WIDTH = 93;
  private readonly PLAYER_HEIGHT = 124;
  private readonly SWORD_IDLE_WIDTH = 108;
  private readonly SWORD_IDLE_HEIGHT = 144;
  private readonly PLAYER_SPEED = 180;

  private readonly SLIME_HEIGHT = 56;
  private readonly TOTAL_SLIMES = 8;

  private health = 100;
  private maxHealth = 100;
  private rubies = 0;
  private hasSword = false;

  private healthBar!: Phaser.GameObjects.Rectangle;
  private healthText!: Phaser.GameObjects.Text;
  private rubyText!: Phaser.GameObjects.Text;
  private slimeCountText!: Phaser.GameObjects.Text;

  private attackCooldown = 0;
  private slimeDamageCooldown = 0;
  private attackFlash?: Phaser.GameObjects.Graphics;
  private swordAttackPlaying = false;
  private punchPlaying = false;

  private rewardPopup?: Phaser.GameObjects.Container;
  private rewardPopupOpen = false;
  private gameOver = false;
  private gameOverContainer?: Phaser.GameObjects.Container;

  private readonly CAVE_X = 1715;
  private readonly CAVE_Y = 400;
  private readonly CAVE_DISTANCE = 115;

  private readonly DUNGEON_X = 2425;
  private readonly DUNGEON_Y = 2475;
  private readonly DUNGEON_DISTANCE = 135;
  private dungeonUnlocked = false;
  private dungeonGate!: Phaser.GameObjects.Container;
  private dungeonHint!: Phaser.GameObjects.Text;

  private caveLabel!: Phaser.GameObjects.Container;
  private caveHint!: Phaser.GameObjects.Text;

  constructor() {
    super("HuntScene");
  }

  preload() {
    this.load.image("huntingMap", "./assets/maps/HuntingG.png");
    this.load.image("dialogue_box", "./assets/sprites/ui/dialogue_box.png");
    this.load.image("player_face", "./assets/sprites/portraits/player_face.png");
    this.load.image("heart_full", "./assets/sprites/items/heart_full.png");
    this.load.image("heart_empty", "./assets/sprites/items/heart_empty.png");

    for (let i = 1; i <= 4; i++) {
      this.load.image(`char_down_${i}`, `./assets/sprites/player/char_down_${i}.png`);
      this.load.image(`char_up_${i}`, `./assets/sprites/player/char_up_${i}.png`);
      this.load.image(`char_left_${i}`, `./assets/sprites/player/char_left_${i}.png`);
      this.load.image(`char_right_${i}`, `./assets/sprites/player/char_right_${i}.png`);
    }

    for (let i = 1; i <= 8; i++) {
      this.load.image(`punch_down_${i}`, `./assets/sprites/punch/punch_down_${i}.png`);
      this.load.image(`punch_up_${i}`, `./assets/sprites/punch/punch_up_${i}.png`);
      this.load.image(`punch_left_${i}`, `./assets/sprites/punch/punch_left_${i}.png`);
      this.load.image(`punch_right_${i}`, `./assets/sprites/punch/punch_right_${i}.png`);

      this.load.image(`sword_idle_down_${i}`, `./assets/sprites/sword/idle/sword_idle_down_${i}.png`);
      this.load.image(`sword_idle_up_${i}`, `./assets/sprites/sword/idle/sword_idle_up_${i}.png`);
      this.load.image(`sword_idle_left_${i}`, `./assets/sprites/sword/idle/sword_idle_left_${i}.png`);
      this.load.image(`sword_idle_right_${i}`, `./assets/sprites/sword/idle/sword_idle_right_${i}.png`);

      this.load.image(`sword_walk_down_${i}`, `./assets/sprites/sword/walk/sword_walk_down_${i}.png`);
      this.load.image(`sword_walk_up_${i}`, `./assets/sprites/sword/walk/sword_walk_up_${i}.png`);
      this.load.image(`sword_walk_left_${i}`, `./assets/sprites/sword/walk/sword_walk_left_${i}.png`);
      this.load.image(`sword_walk_right_${i}`, `./assets/sprites/sword/walk/sword_walk_right_${i}.png`);

      this.load.image(`sword_attack_down_${i}`, `./assets/sprites/sword/attack/sword_attack_down_${i}.png`);
      this.load.image(`sword_attack_up_${i}`, `./assets/sprites/sword/attack/sword_attack_up_${i}.png`);
      this.load.image(`sword_attack_left_${i}`, `./assets/sprites/sword/attack/sword_attack_left_${i}.png`);
      this.load.image(`sword_attack_right_${i}`, `./assets/sprites/sword/attack/sword_attack_right_${i}.png`);
    }

    for (let i = 1; i <= 4; i++) {
      this.load.image(`slime_idle_${i}`, `./assets/sprites/slimes/idle/slime_idle_${i}.png`);
    }

    for (let i = 1; i <= 8; i++) {
      this.load.image(`slime_move_${i}`, `./assets/sprites/slimes/move/slime_move_${i}.png`);
    }

    this.load.json("huntingCollisions", "./assets/data/hunting_collisions.json");
  }

  private createPlayerAnimations() {
    const directions = ["down", "up", "left", "right"];

    for (const direction of directions) {
      const punchKey = `punch_${direction}`;
      if (!this.anims.exists(punchKey)) {
        this.anims.create({
          key: punchKey,
          frames: Array.from({ length: 8 }, (_, index) => ({ key: `punch_${direction}_${index + 1}` })),
          frameRate: 18,
          repeat: 0,
        });
      }

      const swordIdleKey = `sword_idle_${direction}`;
      if (!this.anims.exists(swordIdleKey)) {
        this.anims.create({
          key: swordIdleKey,
          frames: Array.from({ length: 8 }, (_, index) => ({ key: `sword_idle_${direction}_${index + 1}` })),
          frameRate: 6,
          repeat: -1,
        });
      }

      const swordWalkKey = `sword_walk_${direction}`;
      if (!this.anims.exists(swordWalkKey)) {
        this.anims.create({
          key: swordWalkKey,
          frames: Array.from({ length: 8 }, (_, index) => ({ key: `sword_walk_${direction}_${index + 1}` })),
          frameRate: 12,
          repeat: -1,
        });
      }

      const swordAttackKey = `sword_attack_${direction}`;
      if (!this.anims.exists(swordAttackKey)) {
        this.anims.create({
          key: swordAttackKey,
          frames: Array.from({ length: 8 }, (_, index) => ({ key: `sword_attack_${direction}_${index + 1}` })),
          frameRate: 20,
          repeat: 0,
        });
      }

      const normalWalkKey = `normal_walk_${direction}`;
      if (!this.anims.exists(normalWalkKey)) {
        this.anims.create({
          key: normalWalkKey,
          frames: [1, 2, 3, 4].map((i) => ({ key: `char_${direction}_${i}` })),
          frameRate: 12,
          repeat: -1,
        });
      }
    }
  }

  private createSlimeAnimations() {
    if (!this.anims.exists("slime_idle")) {
      this.anims.create({
        key: "slime_idle",
        frames: [1, 2, 3, 4].map((i) => ({ key: `slime_idle_${i}` })),
        frameRate: 8,
        repeat: -1,
      });
    }

    if (!this.anims.exists("slime_move")) {
      this.anims.create({
        key: "slime_move",
        frames: Array.from({ length: 8 }, (_, index) => ({ key: `slime_move_${index + 1}` })),
        frameRate: 12,
        repeat: -1,
      });
    }
  }

  create() {
    this.createPlayerAnimations();
    this.createSlimeAnimations();

    const savedRubies = this.registry.get("playerRubies");
    this.rubies = typeof savedRubies === "number" ? savedRubies : 0;
    this.hasSword = this.registry.get("hasSword") === true;
    if (typeof savedRubies !== "number") this.registry.set("playerRubies", 0);

    const savedHealth = this.registry.get("playerHealth");
    this.health = typeof savedHealth === "number" ? savedHealth : 100;
    if (typeof savedHealth !== "number") this.registry.set("playerHealth", 100);

    const map = this.add.image(0, 0, "huntingMap").setOrigin(0, 0).setDisplaySize(3000, 3000);
    map.setDepth(0);

    this.physics.world.setBounds(0, 0, 3000, 3000);
    this.walls = this.physics.add.staticGroup();

    const data = this.cache.json.get("huntingCollisions") as CollisionData | null;
    if (data?.boxes) {
      data.boxes.forEach((box) => {
        const width = box.width * 3000;
        const height = box.height * 3000;
        const x = box.x * 3000 + width / 2;
        const y = box.y * 3000 + height / 2;
        const wall = this.walls.create(x, y, undefined) as Phaser.Physics.Arcade.Image;
        wall.setVisible(false);
        wall.setDisplaySize(width, height);
        wall.refreshBody();
      });
    }

    this.player = this.physics.add.sprite(
      1715,
      455,
      this.hasSword ? "sword_idle_down_1" : "char_down_1"
    );
    this.player.setDepth(20);
    this.player.setCollideWorldBounds(true);
    this.player.setPipeline(undefined);
    this.setPlayerSize();
    this.updatePlayerBody();
    this.physics.add.collider(this.player, this.walls);

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

    this.attackKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.exitKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    keyboard.resetKeys();
    this.attackCooldown = 0;
    this.slimeDamageCooldown = 0;
    this.swordAttackPlaying = false;
    this.punchPlaying = false;
    this.gameOver = false;
    this.rewardPopupOpen = false;

    this.createSlimes();
    this.createCaveLabel();
    this.createDungeonGate();
    this.createHUD();
    this.checkDungeonUnlock();

    this.cameras.main.setBounds(0, 0, 3000, 3000);
    this.cameras.main.startFollow(this.player, true, 0.10, 0.10);

    if (this.hasSword) this.player.play("sword_idle_down", true);

    this.rubyText.setText(`♦  Rubies: ${this.rubies}`);
    this.updateHealthBar();
    this.updateSlimeCountText();
  }

  update(_time: number, delta: number) {
    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.registry.set("playerHealth", 100);
        this.scene.start("GameScene");
      }
      return;
    }

    this.attackCooldown -= delta;
    this.slimeDamageCooldown -= delta;

    if (this.rewardPopupOpen) {
      this.player.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.exitKey)) this.closeRewardPopup();
      return;
    }

    let dx = 0;
    let dy = 0;
    let moving = false;

    if (this.cursors.w.isDown || this.cursors.up.isDown) {
      dy = -1;
      moving = true;
      this.currentDirection = Animation.Up;
    }
    if (this.cursors.s.isDown || this.cursors.down.isDown) {
      dy = 1;
      moving = true;
      this.currentDirection = Animation.Down;
    }
    if (this.cursors.a.isDown || this.cursors.left.isDown) {
      dx = -1;
      moving = true;
      this.currentDirection = Animation.Left;
    }
    if (this.cursors.d.isDown || this.cursors.right.isDown) {
      dx = 1;
      moving = true;
      this.currentDirection = Animation.Right;
    }

    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    this.player.setVelocity(dx * this.PLAYER_SPEED, dy * this.PLAYER_SPEED);

    if (moving && !this.swordAttackPlaying && !this.punchPlaying) {
      this.updatePlayerFrame();
    } else if (!this.swordAttackPlaying && !this.punchPlaying) {
      if (this.hasSword) {
        const idleKey = `sword_idle_${this.currentDirection}`;
        if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== idleKey) {
          this.player.play(idleKey, true);
        }
      } else {
        this.player.anims.stop();
        this.player.setTexture(`char_${this.currentDirection}_1`);
      }
      this.setPlayerSize();
      this.updatePlayerBody();
    }

    this.updateSlimes(delta);
    this.checkSlimeContactDamage();

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this.attack();
    if (Phaser.Input.Keyboard.JustDown(this.exitKey)) {
      if (!this.tryEnterDungeon()) this.tryEnterCave();
    }
  }

  private setPlayerSize() {
    const animKey = this.player.anims.currentAnim?.key ?? "";
    const textureKey = this.player.texture?.key ?? "";
    const isSwordIdle = animKey.startsWith("sword_idle_") || textureKey.startsWith("sword_idle_");

    if (isSwordIdle) {
      this.player.setDisplaySize(this.SWORD_IDLE_WIDTH, this.SWORD_IDLE_HEIGHT);
    } else {
      this.player.setDisplaySize(this.PLAYER_WIDTH, this.PLAYER_HEIGHT);
    }
  }

  private updatePlayerBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.player.displayWidth * 0.55, this.player.displayHeight * 0.70);
    body.setOffset(this.player.displayWidth * 0.225, this.player.displayHeight * 0.25);
  }

  private updatePlayerFrame() {
    const prefix = this.hasSword ? "sword_walk" : "normal_walk";
    const key = `${prefix}_${this.currentDirection}`;
    if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== key) {
      this.player.play(key, true);
    }
    this.setPlayerSize();
    this.updatePlayerBody();
  }

  private createSlimes() {
    const configs = [
      { x: 1530, minY: 690, maxY: 790, speed: 60 },
      { x: 1350, minY: 900, maxY: 1000, speed: 65 },
      { x: 1120, minY: 1160, maxY: 1300, speed: 68 },
      { x: 1600, minY: 1320, maxY: 1460, speed: 72 },
      { x: 1960, minY: 1540, maxY: 1680, speed: 75 },
      { x: 2200, minY: 1810, maxY: 1950, speed: 78 },
      { x: 2050, minY: 2120, maxY: 2250, speed: 82 },
      { x: 2390, minY: 2270, maxY: 2400, speed: 86 },
    ];

    this.slimes = [];

    configs.forEach((config, index) => {
      const id = index + 1;
      const legacyKey = id === 1 ? "slimeDefeated" : id === 2 ? "slime2Defeated" : `huntSlimeDefeated_${id}`;
      if (this.registry.get(legacyKey) === true) return;

      const sprite = this.physics.add.sprite(config.x, config.minY, "slime_idle_1");
      sprite.setDepth(15);
      sprite.setCollideWorldBounds(true);
      sprite.setDisplaySize(this.SLIME_HEIGHT, this.SLIME_HEIGHT);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(this.SLIME_HEIGHT * 0.70, this.SLIME_HEIGHT * 0.62);
      body.setOffset(this.SLIME_HEIGHT * 0.15, this.SLIME_HEIGHT * 0.22);
      sprite.play("slime_idle");

      const state: SlimeState = {
        id,
        sprite,
        hp: 30,
        alive: true,
        direction: 1,
        minY: config.minY,
        maxY: config.maxY,
        speed: config.speed,
        hearts: [],
      };

      this.createSlimeHealthHearts(state);
      this.slimes.push(state);
    });
  }

  private createSlimeHealthHearts(slime: SlimeState) {
    for (let i = 0; i < 3; i++) {
      const heart = this.add.image(slime.sprite.x - 24 + i * 24, slime.sprite.y - 48, "heart_full");
      heart.setDisplaySize(20, 20);
      heart.setDepth(100);
      slime.hearts.push(heart);
    }
  }

  private updateSlimeHealthHearts(slime: SlimeState) {
    if (!slime.alive || !slime.sprite.active) return;
    const fullHearts = Math.ceil(Phaser.Math.Clamp(slime.hp, 0, 30) / 10);
    for (let i = 0; i < slime.hearts.length; i++) {
      slime.hearts[i].setPosition(slime.sprite.x - 24 + i * 24, slime.sprite.y - 48);
      slime.hearts[i].setTexture(i < fullHearts ? "heart_full" : "heart_empty");
      slime.hearts[i].setVisible(true);
    }
  }

  private updateSlimes(delta: number) {
    for (const slime of this.slimes) {
      if (!slime.alive || !slime.sprite.active) continue;

      slime.sprite.y += slime.direction * slime.speed * (delta / 1000);
      if (slime.sprite.y >= slime.maxY) {
        slime.sprite.y = slime.maxY;
        slime.direction = -1;
      } else if (slime.sprite.y <= slime.minY) {
        slime.sprite.y = slime.minY;
        slime.direction = 1;
      }

      slime.sprite.setVelocity(0, 0);
      if (!slime.sprite.anims.isPlaying || slime.sprite.anims.currentAnim?.key !== "slime_move") {
        slime.sprite.play("slime_move");
      }
      this.updateSlimeHealthHearts(slime);
    }
  }

  private checkSlimeContactDamage() {
    if (this.slimeDamageCooldown > 0 || this.health <= 0) return;

    for (const slime of this.slimes) {
      if (!slime.alive || !slime.sprite.active) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, slime.sprite.x, slime.sprite.y);
      if (distance > 75) continue;

      this.health = Math.max(0, this.health - 10);
      this.slimeDamageCooldown = 900;
      this.registry.set("playerHealth", this.health);
      this.updateHealthBar();

      const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xff0000, 0.12);
      flash.setScrollFactor(0);
      flash.setDepth(1000);
      this.tweens.add({ targets: flash, alpha: 0, duration: 180, onComplete: () => flash.destroy() });

      const angle = Phaser.Math.Angle.Between(slime.sprite.x, slime.sprite.y, this.player.x, this.player.y);
      this.player.x += Math.cos(angle) * 18;
      this.player.y += Math.sin(angle) * 18;

      if (this.health <= 0) {
        this.registry.set("playerHealth", 0);
        this.player.setVelocity(0, 0);
        this.showGameOver();
      }
      return;
    }
  }

  private attack() {
    if (this.attackCooldown > 0 || this.swordAttackPlaying || this.punchPlaying) return;
    this.attackCooldown = 350;

    if (this.hasSword) this.playSwordAttack();
    else this.playPunchAttack();

    const target = this.slimes
      .filter((slime) => slime.alive && slime.sprite.active)
      .map((slime) => ({
        slime,
        distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, slime.sprite.x, slime.sprite.y),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!target || target.distance > 105) return;

    target.slime.hp -= 10;
    this.updateSlimeHealthHearts(target.slime);
    if (target.slime.hp <= 0) this.killSlime(target.slime);
  }

  private playPunchAttack() {
    this.punchPlaying = true;
    this.player.setVelocity(0, 0);

    const key = `punch_${this.currentDirection}`;
    this.player.play(key, true);
    this.setPlayerSize();
    this.updatePlayerBody();

    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.punchPlaying = false;
      this.player.anims.stop();
      this.player.setTexture(`char_${this.currentDirection}_1`);
      this.setPlayerSize();
      this.updatePlayerBody();
    });
  }

  private showPunchEffect() {}

  private playSwordAttack() {
    this.swordAttackPlaying = true;
    const key = `sword_attack_${this.currentDirection}`;
    this.player.play(key, true);
    this.setPlayerSize();
    this.updatePlayerBody();

    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.swordAttackPlaying = false;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      if (body && (Math.abs(body.velocity.x) > 0 || Math.abs(body.velocity.y) > 0)) {
        this.updatePlayerFrame();
      } else {
        const idleKey = `sword_idle_${this.currentDirection}`;
        this.player.play(idleKey, true);
        this.setPlayerSize();
        this.updatePlayerBody();
      }
    });
  }

  private showAttackEffect(hit: boolean) {
    this.attackFlash?.destroy();
    const g = this.add.graphics();
    g.setDepth(40);
    let angle = Phaser.Math.DegToRad(90);

    const target = this.slimes
      .filter((slime) => slime.alive && slime.sprite.active)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(this.player.x, this.player.y, a.sprite.x, a.sprite.y) -
          Phaser.Math.Distance.Between(this.player.x, this.player.y, b.sprite.x, b.sprite.y)
      )[0];

    if (target) {
      angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.sprite.x, target.sprite.y);
    } else {
      if (this.currentDirection === Animation.Up) angle = -Math.PI / 2;
      if (this.currentDirection === Animation.Down) angle = Math.PI / 2;
      if (this.currentDirection === Animation.Left) angle = Math.PI;
      if (this.currentDirection === Animation.Right) angle = 0;
    }

    g.lineStyle(7, hit ? 0xf5d76e : 0xffffff, 0.9);
    g.beginPath();
    g.arc(this.player.x, this.player.y, 55, angle - 0.75, angle + 0.75);
    g.strokePath();
    this.attackFlash = g;
    this.time.delayedCall(120, () => {
      g.destroy();
      if (this.attackFlash === g) this.attackFlash = undefined;
    });
  }

  private killSlime(slime: SlimeState) {
    slime.alive = false;
    const key = slime.id === 1 ? "slimeDefeated" : slime.id === 2 ? "slime2Defeated" : `huntSlimeDefeated_${slime.id}`;
    this.registry.set(key, true);

    const rewardX = slime.sprite.x;
    const rewardY = slime.sprite.y;
    slime.sprite.disableBody(true, true);
    for (const heart of slime.hearts) heart.destroy();
    slime.hearts = [];

    this.giveSlimeReward(rewardX, rewardY);
    this.updateSlimeCountText();
    this.checkDungeonUnlock();
  }

  private giveSlimeReward(x: number, y: number) {
    this.rubies += 20;
    this.registry.set("playerRubies", this.rubies);
    this.rubyText.setText(`♦  Rubies: ${this.rubies}`);

    const reward = this.add.text(x, y - 35, "+20 RUBIES", {
      fontFamily: "Georgia",
      fontSize: "22px",
      fontStyle: "bold",
      color: "#f5d76e",
      stroke: "#000000",
      strokeThickness: 5,
    });
    reward.setOrigin(0.5);
    reward.setDepth(100);
    this.tweens.add({
      targets: reward,
      y: reward.y - 45,
      alpha: 0,
      duration: 1200,
      ease: "Cubic.easeOut",
      onComplete: () => reward.destroy(),
    });
  }

  private checkDungeonUnlock() {
    const remaining = this.slimes.filter((slime) => slime.alive).length;
    this.dungeonUnlocked = remaining === 0;

    if (this.dungeonGate) {
      this.dungeonGate.setVisible(this.dungeonUnlocked);
    }

    if (this.dungeonUnlocked && this.dungeonHint) {
      this.dungeonHint.setText("X TO ENTER");
    }
  }

  private createDungeonGate() {
    this.dungeonGate = this.add.container(this.DUNGEON_X, this.DUNGEON_Y);
    this.dungeonGate.setDepth(60);

    const glow = this.add.circle(0, 0, 72, 0x6d28d9, 0.30);
    const gate = this.add.rectangle(0, 0, 110, 145, 0x171126, 0.96);
    gate.setStrokeStyle(5, 0xa78bfa, 1);
    const inner = this.add.rectangle(0, 8, 72, 105, 0x312e81, 0.92);
    inner.setStrokeStyle(3, 0xc4b5fd, 1);
    const title = this.add.text(0, -105, "NEW DUNGEON", {
      fontFamily: "Georgia",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#f5d76e",
      stroke: "#000000",
      strokeThickness: 4,
    });
    title.setOrigin(0.5);

    this.dungeonHint = this.add.text(0, 105, "X TO ENTER", {
      fontFamily: "Arial",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    });
    this.dungeonHint.setOrigin(0.5);

    this.dungeonGate.add([glow, gate, inner, title, this.dungeonHint]);
    this.dungeonGate.setVisible(false);

    this.tweens.add({
      targets: glow,
      alpha: 0.65,
      scale: 1.22,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private tryEnterDungeon() {
    if (!this.dungeonUnlocked) return false;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.DUNGEON_X, this.DUNGEON_Y);
    if (distance > this.DUNGEON_DISTANCE) return false;

    this.registry.set("playerRubies", this.rubies);
    this.registry.set("playerHealth", this.health);
    this.registry.set("dungeonTwoUnlocked", true);
    this.scene.start("DungeonScene");
    return true;
  }

  private showGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();

    this.gameOverContainer = this.add.container(this.scale.width / 2, this.scale.height / 2);
    this.gameOverContainer.setScrollFactor(0);
    this.gameOverContainer.setDepth(2000);

    const shade = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.78);
    shade.setOrigin(0.5);
    const panel = this.add.rectangle(0, 0, 620, 300, 0x111827, 0.98);
    panel.setStrokeStyle(4, 0xc9a227, 1);
    const title = this.add.text(0, -75, "GAME OVER", {
      fontFamily: "Georgia",
      fontSize: "52px",
      fontStyle: "bold",
      color: "#f5d76e",
      stroke: "#000000",
      strokeThickness: 6,
    });
    title.setOrigin(0.5);
    const message = this.add.text(0, 0, "You ran out of health.", {
      fontFamily: "Arial",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    message.setOrigin(0.5);
    const restart = this.add.text(0, 70, "Press SPACE to restart", {
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#f8fafc",
    });
    restart.setOrigin(0.5);
    this.gameOverContainer.add([shade, panel, title, message, restart]);
  }

  private showSwordQuestPopup() {
    if (this.rewardPopup) this.rewardPopup.destroy(true);
    this.rewardPopupOpen = true;
    this.rewardPopup = this.add.container(this.scale.width / 2, this.scale.height / 2);
    this.rewardPopup.setScrollFactor(0);
    this.rewardPopup.setDepth(500);

    const shade = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.55);
    shade.setOrigin(0.5);
    const panel = this.add.image(0, 0, "dialogue_box");
    panel.setDisplaySize(720, 180);
    const portrait = this.add.image(-285, 0, "player_face");
    portrait.setDisplaySize(82, 82);
    const title = this.add.text(-220, -62, "PLAYER", {
      fontFamily: "Georgia",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#8b5e34",
    });
    const message = this.add.text(-220, -28, "Defeat every slime to unlock the next dungeon!", {
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#2b2118",
      wordWrap: { width: 500 },
      lineSpacing: 4,
    });
    const hint = this.add.text(315, 60, "X  Continue", {
      fontFamily: "Arial",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#4b3621",
    });
    hint.setOrigin(1, 0.5);
    this.rewardPopup.add([shade, panel, portrait, title, message, hint]);
  }

  private closeRewardPopup() {
    this.rewardPopupOpen = false;
    if (this.rewardPopup) {
      this.rewardPopup.destroy(true);
      this.rewardPopup = undefined;
    }
  }

  private createCaveLabel() {
    this.caveLabel = this.add.container(this.CAVE_X, this.CAVE_Y - 55);
    this.caveLabel.setDepth(60);
    const box = this.add.rectangle(0, 0, 125, 30, 0x111827, 0.92);
    box.setStrokeStyle(2, 0xc9a227, 1);
    const title = this.add.text(0, 0, "CAVE SHOP", {
      fontFamily: "Georgia",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#f5d76e",
    });
    title.setOrigin(0.5);
    this.caveHint = this.add.text(0, 23, "X TO ENTER SHOP", {
      fontFamily: "Arial",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    });
    this.caveHint.setOrigin(0.5);
    this.caveLabel.add([box, title, this.caveHint]);
  }

  private createHUD() {
    const hud = this.add.container(18, 18);
    hud.setScrollFactor(0);
    hud.setDepth(200);
    const panel = this.add.rectangle(2, 3, 350, 170, 0x111827, 0.94);
    panel.setOrigin(0, 0);
    panel.setStrokeStyle(2, 0xc9a227, 0.95);
    hud.add(panel);

    const label = this.add.text(21, 18, "HEALTH", {
      fontFamily: "Arial",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#f8fafc",
    });
    hud.add(label);

    const healthBackground = this.add.rectangle(21, 47, 298, 27, 0x374151);
    healthBackground.setOrigin(0, 0);
    healthBackground.setStrokeStyle(1, 0x9ca3af);
    hud.add(healthBackground);

    this.healthBar = this.add.rectangle(24, 50, 292, 21, 0xdc2626);
    this.healthBar.setOrigin(0, 0);
    hud.add(this.healthBar);

    this.healthText = this.add.text(21, 82, "100 / 100 HP", {
      fontFamily: "Arial",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    hud.add(this.healthText);

    this.rubyText = this.add.text(21, 109, `♦  Rubies: ${this.rubies}`, {
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#f8fafc",
    });
    hud.add(this.rubyText);

    this.slimeCountText = this.add.text(21, 136, "Slimes remaining: 8", {
      fontFamily: "Arial",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#c4b5fd",
    });
    hud.add(this.slimeCountText);
  }

  private updateSlimeCountText() {
    const remaining = this.slimes.filter((slime) => slime.alive).length;
    this.slimeCountText.setText(
      remaining > 0 ? `Slimes remaining: ${remaining}` : "NEW DUNGEON UNLOCKED!"
    );
  }

  private updateHealthBar() {
    const percentage = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    this.healthBar.setDisplaySize(292 * percentage, 21);
    this.healthText.setText(`${this.health} / ${this.maxHealth} HP`);
  }

  private tryEnterCave() {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.CAVE_X, this.CAVE_Y);
    if (distance > this.CAVE_DISTANCE) return;
    this.registry.set("playerRubies", this.rubies);
    this.registry.set("playerHealth", this.health);
    this.scene.start("GameScene");
  }
}
