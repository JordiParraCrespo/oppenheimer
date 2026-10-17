Agent coordination experiments: 100 seeds, 400 ticks, mean ±95% CI.

### 1. Protocols: 20 agents, 2 of them misaligned, board latency 3 ticks

| Metric | board | board+signed | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|---:|
| Tasks landed | 581 ±2 | 608 ±2 | 604 ±2 | 647 ±1 | 644 ±1 | 636 ±2 |
| Ticks wasted (duplicates, forged stops) | 530 ±14 | 176 ±7 | 526 ±13 | 0.0 | 0.0 | 0.0 |
| Write conflicts | 5.6 ±0.4 | 6.3 ±0.4 | 0.6 ±0.1 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 106 ±2 | 107 ±3 | 70.7 ±1.8 | 4.6 ±0.5 | 4.6 ±0.4 | 1.2 ±0.2 |
| Secret exposures (reads) | 979 ±47 | 1030 ±47 | 15.3 ±0.7 | 0.8 ±0.2 | 0.7 ±0.2 | 0.7 ±0.2 |
| Ticks lost to false premises | 340 ±16 | 339 ±15 | 12.7 ±1.7 | 3.5 ±0.8 | 3.5 ±0.9 | 3.9 ±0.9 |
| Forged messages obeyed | 87.6 ±2.0 | 26.4 ±1.0 | 86.0 ±1.8 | 0.0 | 0.0 | 0.0 |
| Peak live agents | 80.0 | 80.0 | 80.0 | 20.0 | 20.0 | 20.0 |
| Off-the-books agent ticks | 18572 ±277 | 18588 ±266 | 18489 ±271 | 0.0 | 0.0 | 0.0 |
| Message reads (token cost) | 179128 ±2113 | 177066 ±2037 | 3398 ±10 | 693 ±1 | 1364 ±3 | 694 ±2 |
| Approvals asked of a person | 0.0 | 0.0 | 0.0 | 38.6 ±1.2 | 38.7 ±1.3 | 197 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 8.8 ±1.4 |

### 2. Ablation: the platform minus one control

| Metric | platform | − identity | − leases | − approvals | − spawns | − scanner | − evidence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tasks landed | 647 ±1 | 640 ±1 | 641 ±1 | 653 ±1 | 648 ±1 | 647 ±1 | 645 ±1 |
| Ticks wasted (duplicates, forged stops) | 0.0 | 84.5 ±5.1 | 19.0 ±2.1 | 0.0 | 0.0 | 0.0 | 0.0 |
| Write conflicts | 0.0 | 0.0 | 7.0 ±0.5 | 0.0 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 4.6 ±0.5 | 4.5 ±0.4 | 5.0 ±0.5 | 10.2 ±0.6 | 42.2 ±1.4 | 4.3 ±0.4 | 4.7 ±0.4 |
| Secret exposures (reads) | 0.8 ±0.2 | 0.7 ±0.2 | 1.0 ±0.2 | 0.8 ±0.2 | 0.6 ±0.2 | 15.2 ±0.7 | 0.7 ±0.1 |
| Ticks lost to false premises | 3.5 ±0.8 | 3.6 ±0.9 | 2.9 ±0.7 | 3.2 ±0.7 | 1.7 ±0.6 | 3.1 ±0.7 | 35.1 ±2.7 |
| Forged messages obeyed | 0.0 | 13.3 ±0.7 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| Peak live agents | 20.0 | 20.0 | 20.0 | 20.0 | 80.0 | 20.0 | 20.0 |
| Off-the-books agent ticks | 0.0 | 0.0 | 0.0 | 0.0 | 18511 ±276 | 0.0 | 0.0 |
| Message reads (token cost) | 693 ±1 | 687 ±2 | 2040 ±4 | 891 ±3 | 769 ±2 | 694 ±1 | 691 ±1 |
| Approvals asked of a person | 38.6 ±1.2 | 39.0 ±1.1 | 39.9 ±1.0 | 0.0 | 112 ±3 | 38.8 ±1.2 | 38.7 ±1.3 |
| Approvals still queued | 0.1 | 0.1 | 0.1 | 0.0 | 0.9 ±0.2 | 0.1 | 0.1 |

### 3. 10 agents, 0 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 321 ±1 | 325 ±1 | 327 ±1 | 325 ±1 | 325 ±1 |
| Ticks wasted (duplicates, forged stops) | 6.0 ±0.9 | 0.0 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 1.9 ±0.3 | 1.2 ±0.3 | 0.8 ±0.2 | 0.9 ±0.3 | 0.4 ±0.2 |
| Message reads (token cost) | 10938 ±42 | 1440 ±5 | 335 ±1 | 671 ±3 | 334 ±1 |
| Approvals still queued | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 ±0.1 |

### 3. 10 agents, 1 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 298 ±2 | 303 ±2 | 324 ±1 | 324 ±1 | 321 ±1 |
| Ticks wasted (duplicates, forged stops) | 256 ±14 | 272 ±15 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 50.0 ±2.5 | 34.9 ±2.1 | 2.4 ±0.6 | 2.2 ±0.5 | 0.6 ±0.2 |
| Message reads (token cost) | 43368 ±1400 | 1705 ±13 | 347 ±2 | 685 ±3 | 347 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.0 | 0.0 | 0.3 ±0.1 |

### 3. 10 agents, 3 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 293 ±2 | 300 ±2 | 319 ±2 | 319 ±1 | 315 ±2 |
| Ticks wasted (duplicates, forged stops) | 253 ±12 | 253 ±13 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 63.9 ±1.9 | 41.7 ±2.1 | 4.5 ±0.6 | 5.1 ±0.6 | 1.4 ±0.3 |
| Message reads (token cost) | 48436 ±595 | 1706 ±9 | 368 ±2 | 707 ±3 | 367 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.1 | 0.0 | 0.3 ±0.2 |

### 3. 30 agents, 0 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 941 ±3 | 971 ±2 | 980 ±2 | 972 ±2 | 880 ±4 |
| Ticks wasted (duplicates, forged stops) | 19.1 ±1.7 | 0.0 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 5.4 ±0.6 | 3.1 ±0.6 | 3.1 ±0.5 | 2.5 ±0.4 | 0.5 ±0.2 |
| Message reads (token cost) | 96344 ±283 | 4300 ±8 | 1005 ±2 | 2003 ±4 | 1006 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.1 | 0.1 | 102 ±4 |

### 3. 30 agents, 3 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 856 ±3 | 905 ±3 | 972 ±2 | 966 ±2 | 873 ±4 |
| Ticks wasted (duplicates, forged stops) | 782 ±21 | 777 ±27 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 159 ±4 | 105 ±4 | 6.2 ±0.7 | 6.6 ±0.7 | 1.3 ±0.3 |
| Message reads (token cost) | 395171 ±5757 | 5077 ±23 | 1042 ±2 | 2042 ±5 | 1041 ±3 |
| Approvals still queued | 0.0 | 0.0 | 0.2 ±0.2 | 0.2 ±0.1 | 102 ±3 |

### 3. 30 agents, 9 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 820 ±4 | 900 ±3 | 957 ±2 | 950 ±2 | 859 ±4 |
| Ticks wasted (duplicates, forged stops) | 698 ±15 | 723 ±22 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 195 ±4 | 131 ±3 | 14.0 ±1.0 | 14.5 ±1.1 | 2.7 ±0.5 |
| Message reads (token cost) | 418111 ±3334 | 5111 ±15 | 1104 ±3 | 2103 ±5 | 1104 ±4 |
| Approvals still queued | 0.0 | 0.0 | 0.2 ±0.1 | 0.2 ±0.1 | 101 ±3 |

### 3. 100 agents, 0 misaligned (20 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 2861 ±19 | 1935 ±2 | 3254 ±6 | 1931 ±2 | 2486 ±10 |
| Ticks wasted (duplicates, forged stops) | 41.5 ±4.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 17.1 ±1.7 | 7.7 ±1.5 | 10.8 ±1.1 | 6.0 ±0.8 | 0.6 ±0.3 |
| Message reads (token cost) | 976275 ±6036 | 8576 ±8 | 3352 ±6 | 3985 ±3 | 3352 ±6 |
| Approvals still queued | 0.0 | 0.0 | 11.2 ±4.8 | 0.6 ±0.3 | 793 ±10 |

### 3. 100 agents, 10 misaligned (20 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 2410 ±23 | 1777 ±7 | 3228 ±7 | 1906 ±3 | 2483 ±9 |
| Ticks wasted (duplicates, forged stops) | 2434 ±59 | 1489 ±48 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 543 ±10 | 357 ±10 | 22.9 ±1.6 | 17.9 ±1.5 | 1.4 ±0.5 |
| Message reads (token cost) | 4009365 ±41310 | 10796 ±35 | 3476 ±7 | 4083 ±5 | 3479 ±8 |
| Approvals still queued | 0.0 | 0.0 | 10.3 ±3.7 | 0.5 ±0.4 | 790 ±9 |

### 3. 100 agents, 30 misaligned (20 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 2056 ±19 | 1983 ±9 | 3180 ±8 | 1862 ±4 | 2467 ±11 |
| Ticks wasted (duplicates, forged stops) | 1555 ±62 | 1254 ±58 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 644 ±12 | 429 ±6 | 47.0 ±3.2 | 41.0 ±2.6 | 2.4 ±0.6 |
| Message reads (token cost) | 3862830 ±34210 | 11744 ±30 | 3685 ±10 | 4229 ±7 | 3679 ±11 |
| Approvals still queued | 0.0 | 0.0 | 9.2 ±2.5 | 0.8 ±0.6 | 791 ±10 |

### 4. Honest agents only: the cost of the medium

| Metric | board, latency 0 | board, latency 1 | board, latency 3 | board, latency 10 | platform |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 638 ±1 | 637 ±1 | 633 ±1 | 617 ±2 | 652 ±1 |
| Ticks wasted (duplicates, forged stops) | 0.0 | 1.6 ±0.3 | 11.6 ±1.0 | 123 ±6 | 0.0 |
| Write conflicts | 0.0 | 1.3 ±0.2 | 5.2 ±0.5 | 24.1 ±0.9 | 0.0 |
| Message reads (token cost) | 43199 ±99 | 43216 ±99 | 43128 ±93 | 42581 ±93 | 669 ±1 |

### 5. Sensitivity: 50 draws of every rate × [0.5, 2] (20 agents: 10 seeds per draw; 100 agents: 3 seeds per draw)

| Conclusion | Holds in |
|---|---:|
| platform lands at least as much as board (within 2%) | 100% |
| platform executes fewer bad risky actions than board | 100% |
| platform executes fewer bad risky actions than hub | 98% |
| hub wastes fewer ticks than board | 32% |
| signatures alone cut forged messages obeyed by half or more | 76% |
| every risky action to a person lands less than lanes | 94% |
| platform+hub lands less than platform at 100 agents | 100% |

