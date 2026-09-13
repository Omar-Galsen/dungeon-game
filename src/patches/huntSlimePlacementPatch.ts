import HuntScene from "../scenes/HuntScene";

type SlimeConfig = {
  x: number;
  minY: number;
  maxY: number;
  speed: number;
};

export function installHuntSlimePlacementPatch() {
  const proto = HuntScene.prototype as any;
  if (proto.__slimePlacementPatched) return;
  proto.__slimePlacementPatched = true;

  proto.createSlimes = function () {
    const configs: SlimeConfig[] = [
      { x: 1530, minY: 705, maxY: 805, speed: 60 },
      { x: 1360, minY: 915, maxY: 1015, speed: 65 },
      { x: 1135, minY: 1180, maxY: 1295, speed: 68 },
      { x: 1600, minY: 1340, maxY: 1455, speed: 72 },
      { x: 1950, minY: 1555, maxY: 1680, speed: 75 },
      { x: 2190, minY: 1815, maxY: 1935, speed: 78 },
      { x: 2050, minY: 2115, maxY: 2235, speed: 82 },
      { x: 2380, minY: 2285, maxY: 2395, speed: 86 },
    ];

    this.slimes = [];

    configs.forEach((config, index) => {
      const id = index + 1;
      const legacyKey =
        id === 1
          ? "slimeDefeated"
          : id === 2
            ? "slime2Defeated"
            : `huntSlimeDefeated_${id}`;

      if (this.registry.get(legacyKey) === true) return;

      const startY = (config.minY + config.maxY) / 2;
      const sprite = this.physics.add.sprite(config.x, startY, "slime_idle_1");
      sprite.setDepth(15);
      sprite.setCollideWorldBounds(true);
      sprite.setDisplaySize(this.SLIME_HEIGHT, this.SLIME_HEIGHT);

      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(this.SLIME_HEIGHT * 0.70, this.SLIME_HEIGHT * 0.62);
      body.setOffset(this.SLIME_HEIGHT * 0.15, this.SLIME_HEIGHT * 0.22);

      sprite.play("slime_idle");
      this.physics.add.collider(sprite, this.walls);

      const state = {
        id,
        sprite,
        hp: 30,
        alive: true,
        direction: index % 2 === 0 ? 1 : -1,
        minY: config.minY,
        maxY: config.maxY,
        speed: config.speed,
        hearts: [],
      };

      this.createSlimeHealthHearts(state);
      this.slimes.push(state);
    });
  };
}
