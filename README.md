# valley-circuit-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/fzy2012/valley-circuit-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/fzy2012/valley-circuit-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Valley Circuit is an arcade flight game in a single static page: take off from the home strip, thread all eight glowing rings down a winding mountain valley, and put the aircraft gently on the far runway before the fuel runs out. It flies with real discipline — bank to turn, mind the stall, watch the fuel burn — under a full set of lit instruments: airspeed and altitude tapes, an attitude ball, a compass strip and a next-ring guide. The world is a software-rendered 3D valley (no WebGL, no assets, no network), drawn fresh every frame from one seeded height function that the flight model, the course and the renderer all share.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
# (or just open game/index.html — it runs offline, straight from the file)
```

Controls: W/S throttle, arrow keys pitch and bank (they steer the nose wheel on the ground), mouse steering when no key is held, Space brake, P pause, M sound, Enter to start or fly again.

---

<sub>Entered on [make.fun](https://make.fun/?ref=6cmt2rrm&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
