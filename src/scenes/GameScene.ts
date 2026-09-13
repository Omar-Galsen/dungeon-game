import Phaser from "phaser";
import collisions from "../data/collisions.json";

enum Animation {
  Down = "down",
  Up = "up",
  Left = "left",
  Right = "right",
}

type CollisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private walls!: Phaser.Physics.Arcade.StaticGroup;

  private cursors!: Record<
    "w" | "a" | "s" | "d" | "up" | "left" | "down" | "right",
    Phaser.Input.Keyboard.Key
  >;

  private currentDirection: Animation = Animation.Down;
  private frame = 1;
  private animationTimer = 0;

  private readonly PLAYER_HEIGHT = 86;
  private readonly PLAYER_SPEED = 180;

  private health = 100;
  private maxHealth = 100;
  private rubies = 0;
  private swordOwned = false;

  private healthBar!: Phaser.GameObjects.Rectangle;
  private healthText!: Phaser.GameObjects.Text;
  private rubyText!: Phaser.GameObjects.Text;

  private dialogueOpen = false;
  private dialogueStep = 0;
  private dialogueFinished = false;
  private swordShopOpen = false;

  private dialogueContainer!: Phaser.GameObjects.Container;
  private dialogueTitle!: Phaser.GameObjects.Text;
  private dialogueMessage!: Phaser.GameObjects.Text;
  private dialoguePortrait!: Phaser.GameObjects.Image;
  private questionMark!: Phaser.GameObjects.Container;

  private readonly SHOPKEEPER_X = 500;
  private readonly SHOPKEEPER_Y = 250;
  private readonly INTERACTION_DISTANCE = 105;

  private huntGuide!: Phaser.GameObjects.Container;
  private huntGuideVisible = false;

  private readonly EXIT_X = 500;
  private readonly EXIT_Y = 625;
  private readonly EXIT_DISTANCE = 90;

  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("background", "/assets/maps/background.png");
    this.load.image("dialogue_box", "/assets/sprites/ui/dialogue_box.png");
    this.load.image("shopkeeper_face", "/assets/sprites/portraits/shopkeeper_face.png");
    this.load.image("player_face", "/assets/sprites/portraits/player_face.png");

    for (let i = 1; i <= 4; i++) {
      this.load.image(`char_down_${i}`, `/assets/sprites/player/char_down_${i}.png`);
      this.load.image(`char_up_${i}`, `/assets/sprites/player/char_up_${i}.png`);
      this.load.image(`char_left_${i}`, `/assets/sprites/player/char_left_${i}.png`);
      this.load.image(`char_right_${i}`, `/assets/sprites/player/char_right_${i}.png`);
    }
  }

  private createPlayerAnimations() {
    const directions = ["down", "up", "left", "right"];

    for (const direction of directions) {
      this.anims.create({
        key: `player_${direction}`,
        frames: [1, 2, 3, 4].map((i) => ({
          key: `char_${direction}_${i}`,
        })),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  create() {
    const savedRubies = this.registry.get("playerRubies");
    this.rubies = typeof savedRubies === "number" ? savedRubies : 0;
    if (typeof savedRubies !== "number") this.registry.set("playerRubies", 0);

    this.swordOwned = this.registry.get("hasSword") === true;

    const savedHealth = this.registry.get("playerHealth");
    this.health = typeof savedHealth === "number" ? savedHealth : 100;
    if (typeof savedHealth !== "number") this.registry.set("playerHealth", 100);

    this.createPlayerAnimations();

    const background = this.add.image(this.scale.width / 2, this.scale.height / 2, "background");
    background.setDisplaySize(789.65, 620);
    background.setDepth(0);

    this.walls = this.physics.add.staticGroup();
    const boxes = collisions.boxes as CollisionBox[];
    boxes.forEach((box) => {
      const width = box.width * background.displayWidth;
      const height = box.height * background.displayHeight;
      const x = background.x - background.displayWidth / 2 + box.x * background.displayWidth + width / 2;
      const y = background.y - background.displayHeight / 2 + box.y * background.displayHeight + height / 2;
      const wall = this.walls.create(x, y, undefined) as Phaser.Physics.Arcade.Image;
      wall.setVisible(false);
      wall.setDisplaySize(width, height);
      wall.refreshBody();
    });

    this.player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 105, "char_down_1");
    this.player.setDepth(20);
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

    keyboard.on("keydown-SPACE", () => {
      if (this.dialogueOpen) { this.nextDialogue(); return; }
      if (this.swordShopOpen) { this.buySword(); return; }
      if (this.isNearShopkeeper()) this.startDialogue();
    });
    keyboard.on("keydown-X", () => this.tryExit());

    this.createHUD();
    this.createQuestionMark();
    this.createDialogue();
    this.createHuntGuide();
    this.updateHealthBar();
    this.rubyText.setText(`Rubies: ${this.rubies}`);
  }

  update(_time: number, _delta: number) {
    let dx = 0, dy = 0, moving = false;
    if (this.cursors.w.isDown || this.cursors.up.isDown) { dy = -1; moving = true; this.currentDirection = Animation.Up; }
    if (this.cursors.s.isDown || this.cursors.down.isDown) { dy = 1; moving = true; this.currentDirection = Animation.Down; }
    if (this.cursors.a.isDown || this.cursors.left.isDown) { dx = -1; moving = true; this.currentDirection = Animation.Left; }
    if (this.cursors.d.isDown || this.cursors.right.isDown) { dx = 1; moving = true; this.currentDirection = Animation.Right; }
    if (dx !== 0 && dy !== 0) { const length = Math.sqrt(dx * dx + dy * dy); dx /= length; dy /= length; }

    if (this.dialogueOpen) this.player.setVelocity(0, 0);
    else this.player.setVelocity(dx * this.PLAYER_SPEED, dy * this.PLAYER_SPEED);

    if (moving && !this.dialogueOpen) {
      this.updatePlayerFrame();
    } else {
      this.player.anims.stop();
      this.player.setTexture(`char_${this.currentDirection}_1`);
      this.setPlayerSize();
      this.updatePlayerBody();
    }
    this.updateQuestionMark();
    this.updateHuntGuide();
  }

  private setPlayerSize() {
    const source = this.player.texture.getSourceImage();
    if (source.height > 0) this.player.setScale(this.PLAYER_HEIGHT / source.height);
  }

  private updatePlayerBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.player.displayWidth * 0.55, this.player.displayHeight * 0.70);
    body.setOffset(this.player.displayWidth * 0.225, this.player.displayHeight * 0.25);
  }

  private updatePlayerFrame() {
    const key = `player_${this.currentDirection}`;
    if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== key) this.player.play(key, true);
    this.setPlayerSize();
    this.updatePlayerBody();
  }

  private createHUD() {
    const hud = this.add.container(18, 18); hud.setDepth(100);
    const panel = this.add.rectangle(0, 0, 255, 108, 0x111827, 0.94); panel.setOrigin(0, 0); panel.setStrokeStyle(2, 0xc9a227, 0.95); hud.add(panel);
    const label = this.add.text(15, 10, "HEALTH", { fontFamily: "Arial", fontSize: "14px", fontStyle: "bold", color: "#f8fafc" }); hud.add(label);
    const healthBackground = this.add.rectangle(15, 34, 225, 20, 0x374151); healthBackground.setOrigin(0, 0); healthBackground.setStrokeStyle(1, 0x9ca3af); hud.add(healthBackground);
    this.healthBar = this.add.rectangle(18, 37, 219, 14, 0xdc2626); this.healthBar.setOrigin(0, 0); hud.add(this.healthBar);
    this.healthText = this.add.text(15, 59, "100 / 100 HP", { fontFamily: "Arial", fontSize: "14px", fontStyle: "bold", color: "#ffffff" }); hud.add(this.healthText);
    const rubyIcon = this.add.text(15, 78, "♦", { fontSize: "22px", fontStyle: "bold", color: "#ef4444" }); hud.add(rubyIcon);
    this.rubyText = this.add.text(38, 80, `Rubies: ${this.rubies}`, { fontFamily: "Arial", fontSize: "16px", fontStyle: "bold", color: "#f8fafc" }); hud.add(this.rubyText);
  }

  private createQuestionMark() {
    this.questionMark = this.add.container(this.SHOPKEEPER_X, this.SHOPKEEPER_Y - 58); this.questionMark.setDepth(50);
    const glow = this.add.circle(0, 0, 23, 0x000000, 0.48);
    const bubble = this.add.circle(0, 0, 19, 0xf8fafc, 1); bubble.setStrokeStyle(2, 0xc9a227, 1);
    const question = this.add.text(0, -1, "?", { fontFamily: "Georgia", fontSize: "28px", fontStyle: "bold", color: "#7c3aed" }); question.setOrigin(0.5);
    this.questionMark.add([glow, bubble, question]);
    this.tweens.add({ targets: this.questionMark, y: this.SHOPKEEPER_Y - 66, duration: 750, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private updateQuestionMark() {
    if (this.dialogueFinished) { this.questionMark.setVisible(false); return; }
    const near = this.isNearShopkeeper();
    if (this.dialogueOpen) { this.questionMark.setAlpha(0.35); return; }
    if (near) { this.questionMark.setAlpha(1); this.questionMark.setScale(1.12); }
    else { this.questionMark.setAlpha(0.82); this.questionMark.setScale(1); }
  }

  private isNearShopkeeper() {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, this.SHOPKEEPER_X, this.SHOPKEEPER_Y) <= this.INTERACTION_DISTANCE;
  }

  private createDialogue() {
    this.dialogueContainer = this.add.container(this.scale.width / 2, this.scale.height - 125); this.dialogueContainer.setDepth(120); this.dialogueContainer.setVisible(false);
    const shadow = this.add.rectangle(5, 7, 720, 135, 0x000000, 0.55); shadow.setOrigin(0.5);
    const panel = this.add.image(0, 0, "dialogue_box"); panel.setDisplaySize(720, 135);
    this.dialoguePortrait = this.add.image(-285, 0, "shopkeeper_face"); this.dialoguePortrait.setDisplaySize(82, 82);
    this.dialogueTitle = this.add.text(-220, -48, "", { fontFamily: "Georgia", fontSize: "19px", fontStyle: "bold", color: "#f5d76e" });
    this.dialogueMessage = this.add.text(-220, -14, "", { fontFamily: "Arial", fontSize: "18px", color: "#2b2118", wordWrap: { width: 500 }, lineSpacing: 4 });
    const hint = this.add.text(320, 48, "SPACE  Continue", { fontFamily: "Arial", fontSize: "14px", fontStyle: "bold", color: "#4b3621" }); hint.setOrigin(1, 0.5);
    this.dialogueContainer.add([shadow, panel, this.dialoguePortrait, this.dialogueTitle, this.dialogueMessage, hint]);
  }

  private startDialogue() { this.dialogueOpen = true; this.dialogueStep = 0; this.player.setVelocity(0, 0); this.dialogueContainer.setVisible(true); this.showDialogue(); }
  private showDialogue() {
    if (this.swordOwned) { this.dialogueTitle.setText("SHOPKEEPER"); this.dialoguePortrait.setTexture("shopkeeper_face"); this.dialogueMessage.setText("Your sword is ready. Good luck on your journey!"); return; }
    if (this.dialogueStep === 0) { this.dialogueTitle.setText("PLAYER"); this.dialoguePortrait.setTexture("player_face"); this.dialogueMessage.setText(this.rubies >= 20 ? `I have ${this.rubies} rubies.` : "I have no rubies."); return; }
    if (this.dialogueStep === 1) { this.dialogueTitle.setText("SHOPKEEPER"); this.dialoguePortrait.setTexture("shopkeeper_face"); this.dialogueMessage.setText(this.rubies >= 20 ? "Perfect. I can sell you this sword for 20 rubies." : "You need 20 rubies. Go hunting and come back when you have enough."); return; }
    if (this.dialogueStep === 2 && this.rubies >= 20) { this.dialogueOpen = false; this.dialogueContainer.setVisible(false); this.openSwordShop(); return; }
    this.dialogueOpen = false; this.dialogueFinished = true; this.dialogueContainer.setVisible(false);
  }
  private nextDialogue() { this.dialogueStep += 1; this.showDialogue(); }

  private openSwordShop() {
    this.swordShopOpen = true; this.dialogueContainer.setVisible(true); this.dialogueTitle.setText("SWORD SHOP"); this.dialoguePortrait.setTexture("shopkeeper_face"); this.dialogueMessage.setText("Sword — 20 rubies\nPress SPACE to buy.");
  }
  private buySword() {
    if (this.rubies < 20 || this.swordOwned) return;
    this.rubies -= 20; this.swordOwned = true; this.registry.set("playerRubies", this.rubies); this.registry.set("hasSword", true); this.rubyText.setText(`Rubies: ${this.rubies}`); this.swordShopOpen = false; this.dialogueFinished = true; this.dialogueContainer.setVisible(false);
  }

  private createHuntGuide() {
    this.huntGuide = this.add.container(this.EXIT_X, this.EXIT_Y - 45); this.huntGuide.setDepth(80); this.huntGuide.setVisible(false);
    const bg = this.add.rectangle(0, 0, 250, 46, 0x111827, 0.9); bg.setStrokeStyle(2, 0xc9a227, 1);
    const text = this.add.text(0, 0, "Press X to go hunting", { fontFamily: "Arial", fontSize: "16px", fontStyle: "bold", color: "#ffffff" }); text.setOrigin(0.5);
    this.huntGuide.add([bg, text]);
  }
  private updateHuntGuide() {
    const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.EXIT_X, this.EXIT_Y) <= this.EXIT_DISTANCE;
    if (near !== this.huntGuideVisible) { this.huntGuideVisible = near; this.huntGuide.setVisible(near); }
  }
  private tryExit() {
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.EXIT_X, this.EXIT_Y) <= this.EXIT_DISTANCE) {
      this.registry.set("playerRubies", this.rubies); this.registry.set("playerHealth", this.health); this.scene.start("HuntScene");
    }
  }
  private updateHealthBar() {
    const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1); this.healthBar.width = 219 * ratio; this.healthText.setText(`${this.health} / ${this.maxHealth} HP`);
  }
}