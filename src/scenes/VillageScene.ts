import Phaser from "phaser";

export default class VillageScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private direction = "right";
  private attacking = false;
  private readonly WORLD_W = 3072;
  private readonly WORLD_H = 2048;
  private readonly SPEED = 180;

  constructor() { super("VillageScene"); }

  preload() {
    this.load.image("villageMap", "./assets/maps/Burning Riverside Village Map.png");
    for (let i = 1; i <= 8; i++) {
      for (const d of ["down", "up", "left", "right"]) {
        this.load.image(`v_sword_idle_${d}_${i}`, `./assets/sprites/sword/idle/sword_idle_${d}_${i}.png`);
        this.load.image(`v_sword_walk_${d}_${i}`, `./assets/sprites/sword/walk/sword_walk_${d}_${i}.png`);
        this.load.image(`v_sword_attack_${d}_${i}`, `./assets/sprites/sword/attack/sword_attack_${d}_${i}.png`);
      }
    }
  }

  create() {
    this.physics.world.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
    this.cameras.main.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
    this.add.image(0, 0, "villageMap").setOrigin(0).setDisplaySize(this.WORLD_W, this.WORLD_H);
    this.createAnimations();
    this.player = this.physics.add.sprite(180, 900, "v_sword_idle_right_1").setDisplaySize(108, 144).setDepth(20).setCollideWorldBounds(true);
    this.player.play("v_sword_idle_right");
    this.cameras.main.startFollow(this.player, true, .1, .1);
    this.add.text(18, 18, "RIVERSIDE VILLAGE — ELIMINATE THE INVASION", { fontFamily:"Arial", fontSize:"20px", fontStyle:"bold", color:"#ffffff", stroke:"#000000", strokeThickness:5, backgroundColor:"#541b14", padding:{x:10,y:6} }).setScrollFactor(0).setDepth(1000);
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = { w:kb.addKey("W"), a:kb.addKey("A"), s:kb.addKey("S"), d:kb.addKey("D") };
    this.attackKey = kb.addKey("J");
  }

  update() {
    if (this.attacking) return;
    let x=0,y=0;
    if(this.wasd.w.isDown||this.cursors.up.isDown){y=-1;this.direction="up";}
    if(this.wasd.s.isDown||this.cursors.down.isDown){y=1;this.direction="down";}
    if(this.wasd.a.isDown||this.cursors.left.isDown){x=-1;this.direction="left";}
    if(this.wasd.d.isDown||this.cursors.right.isDown){x=1;this.direction="right";}
    if(x&&y){x*=.7071;y*=.7071;}
    this.player.setVelocity(x*this.SPEED,y*this.SPEED);
    this.player.play(x||y?`v_sword_walk_${this.direction}`:`v_sword_idle_${this.direction}`,true);
    if(Phaser.Input.Keyboard.JustDown(this.attackKey)) this.attack();
  }

  private attack(){
    this.attacking=true; this.player.setVelocity(0,0); this.player.setDisplaySize(135,180); this.player.play(`v_sword_attack_${this.direction}`,true);
    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{this.attacking=false;this.player.setDisplaySize(108,144);this.player.play(`v_sword_idle_${this.direction}`,true);});
  }

  private createAnimations(){
    for(const d of ["down","up","left","right"]){
      for(const kind of ["idle","walk","attack"]){
        const key=`v_sword_${kind}_${d}`;
        if(!this.anims.exists(key))this.anims.create({key,frames:Array.from({length:8},(_,i)=>({key:`v_sword_${kind}_${d}_${i+1}`})),frameRate:kind==="attack"?20:kind==="walk"?12:6,repeat:kind==="attack"?0:-1});
      }
    }
  }
}
