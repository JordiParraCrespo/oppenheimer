Agent coordination experiments: 100 seeds, 400 ticks, mean ±95% CI.

### 1. Protocols: 20 agents, 2 of them misaligned, board latency 3 ticks

| Metric | board | board+signed | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|---:|
| Tasks landed | 581 ±2 | 607 ±2 | 603 ±2 | 648 ±1 | 645 ±1 | 636 ±2 |
| Ticks wasted (duplicates, forged stops) | 537 ±15 | 174 ±7 | 532 ±13 | 0.0 | 0.0 | 0.0 |
| Write conflicts | 6.4 ±0.5 | 6.8 ±0.5 | 0.7 ±0.2 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 108 ±3 | 107 ±2 | 71.7 ±2.0 | 4.5 ±0.4 | 4.4 ±0.4 | 1.4 ±0.2 |
| Secret exposures (reads) | 963 ±55 | 990 ±55 | 14.9 ±0.6 | 0.9 ±0.2 | 0.6 ±0.2 | 0.7 ±0.2 |
| Ticks lost to false premises | 328 ±15 | 345 ±15 | 13.9 ±2.0 | 4.2 ±0.9 | 4.2 ±1.0 | 4.1 ±1.0 |
| Forged messages obeyed | 87.5 ±2.0 | 25.4 ±0.9 | 86.8 ±2.0 | 0.0 | 0.0 | 0.0 |
| Peak live agents | 80.0 | 80.0 | 80.0 | 20.0 | 20.0 | 20.0 |
| Off-the-books agent ticks | 18673 ±279 | 18844 ±259 | 18839 ±290 | 0.0 | 0.0 | 0.0 |
| Message reads (token cost) | 179767 ±2213 | 178460 ±1972 | 3406 ±10 | 695 ±2 | 1363 ±3 | 694 ±2 |
| Approvals asked of a person | 0.0 | 0.0 | 0.0 | 39.9 ±1.3 | 39.1 ±1.3 | 197 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 8.6 ±1.4 |

### 2. Ablation: the platform minus one control

| Metric | platform | − identity | − leases | − approvals | − spawns | − scanner | − evidence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tasks landed | 648 ±1 | 641 ±1 | 642 ±1 | 653 ±1 | 648 ±1 | 647 ±1 | 645 ±1 |
| Ticks wasted (duplicates, forged stops) | 0.0 | 79.5 ±4.7 | 19.0 ±2.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| Write conflicts | 0.0 | 0.0 | 7.2 ±0.5 | 0.0 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 4.5 ±0.4 | 4.7 ±0.4 | 4.8 ±0.5 | 9.9 ±0.7 | 42.5 ±1.3 | 4.6 ±0.4 | 4.7 ±0.4 |
| Secret exposures (reads) | 0.9 ±0.2 | 0.7 ±0.2 | 0.8 ±0.2 | 0.7 ±0.1 | 0.9 ±0.2 | 15.9 ±0.7 | 0.8 ±0.2 |
| Ticks lost to false premises | 4.2 ±0.9 | 3.7 ±1.0 | 3.1 ±0.8 | 3.6 ±0.9 | 1.5 ±0.6 | 3.8 ±1.1 | 37.6 ±2.8 |
| Forged messages obeyed | 0.0 | 12.8 ±0.6 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| Peak live agents | 20.0 | 20.0 | 20.0 | 20.0 | 80.0 | 20.0 | 20.0 |
| Off-the-books agent ticks | 0.0 | 0.0 | 0.0 | 0.0 | 18798 ±249 | 0.0 | 0.0 |
| Message reads (token cost) | 695 ±2 | 687 ±2 | 2040 ±4 | 891 ±3 | 769 ±3 | 694 ±2 | 692 ±2 |
| Approvals asked of a person | 39.9 ±1.3 | 39.0 ±1.1 | 38.8 ±1.2 | 0.0 | 115 ±2 | 38.1 ±1.2 | 38.4 ±1.1 |
| Approvals still queued | 0.1 | 0.1 | 0.1 | 0.0 | 1.1 ±0.3 | 0.1 | 0.1 |

### 3. 10 agents, 0 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 322 ±1 | 326 ±1 | 326 ±1 | 326 ±1 | 325 ±1 |
| Ticks wasted (duplicates, forged stops) | 5.5 ±0.9 | 0.0 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 2.0 ±0.5 | 1.5 ±0.4 | 0.9 ±0.3 | 1.1 ±0.3 | 0.3 ±0.1 |
| Message reads (token cost) | 10965 ±46 | 1442 ±5 | 335 ±1 | 672 ±2 | 335 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.0 | 0.1 | 0.3 ±0.2 |

### 3. 10 agents, 1 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 297 ±2 | 303 ±2 | 323 ±1 | 323 ±1 | 322 ±1 |
| Ticks wasted (duplicates, forged stops) | 275 ±17 | 264 ±16 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 51.3 ±2.5 | 34.9 ±2.2 | 2.4 ±0.4 | 1.9 ±0.5 | 0.7 ±0.2 |
| Message reads (token cost) | 45163 ±1144 | 1699 ±13 | 348 ±2 | 685 ±2 | 348 ±1 |
| Approvals still queued | 0.0 | 0.0 | 0.0 | 0.1 | 0.3 ±0.1 |

### 3. 10 agents, 3 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 294 ±2 | 300 ±2 | 319 ±1 | 318 ±1 | 316 ±1 |
| Ticks wasted (duplicates, forged stops) | 247 ±13 | 252 ±13 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 63.7 ±2.3 | 43.2 ±1.8 | 4.8 ±0.6 | 4.6 ±0.5 | 1.1 ±0.3 |
| Message reads (token cost) | 48517 ±557 | 1704 ±9 | 366 ±2 | 704 ±3 | 368 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.1 | 0.1 | 0.3 ±0.2 |

### 3. 30 agents, 0 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 941 ±4 | 970 ±2 | 980 ±2 | 972 ±2 | 881 ±4 |
| Ticks wasted (duplicates, forged stops) | 16.8 ±2.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 5.5 ±0.6 | 3.4 ±0.5 | 3.0 ±0.4 | 3.2 ±0.5 | 0.8 ±0.2 |
| Message reads (token cost) | 96323 ±360 | 4298 ±9 | 1005 ±2 | 2001 ±4 | 1004 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.3 ±0.2 | 0.1 ±0.1 | 99.8 ±3.5 |

### 3. 30 agents, 3 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 855 ±3 | 902 ±3 | 973 ±2 | 965 ±2 | 873 ±3 |
| Ticks wasted (duplicates, forged stops) | 791 ±22 | 803 ±24 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 161 ±5 | 108 ±3 | 7.1 ±0.6 | 7.1 ±0.8 | 1.0 ±0.3 |
| Message reads (token cost) | 395650 ±5915 | 5095 ±18 | 1044 ±3 | 2039 ±4 | 1042 ±2 |
| Approvals still queued | 0.0 | 0.0 | 0.2 ±0.1 | 0.1 | 101 ±3 |

### 3. 30 agents, 9 misaligned (50 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 818 ±4 | 898 ±3 | 957 ±2 | 951 ±3 | 859 ±4 |
| Ticks wasted (duplicates, forged stops) | 680 ±24 | 725 ±20 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 197 ±5 | 131 ±3 | 14.9 ±1.2 | 15.0 ±0.9 | 2.6 ±0.4 |
| Message reads (token cost) | 417857 ±2675 | 5107 ±13 | 1103 ±3 | 2103 ±5 | 1105 ±4 |
| Approvals still queued | 0.0 | 0.0 | 0.1 | 0.2 ±0.1 | 101 ±3 |

### 3. 100 agents, 0 misaligned (20 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 2863 ±19 | 1934 ±2 | 3254 ±7 | 1930 ±2 | 2493 ±11 |
| Ticks wasted (duplicates, forged stops) | 44.6 ±5.6 | 0.0 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 16.4 ±1.6 | 7.5 ±1.2 | 10.1 ±1.8 | 6.1 ±0.8 | 0.5 ±0.3 |
| Message reads (token cost) | 977950 ±5934 | 8571 ±8 | 3354 ±8 | 3983 ±4 | 3354 ±8 |
| Approvals still queued | 0.0 | 0.0 | 9.8 ±3.9 | 0.7 ±0.6 | 788 ±13 |

### 3. 100 agents, 10 misaligned (20 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 2420 ±23 | 1722 ±9 | 3230 ±9 | 1919 ±3 | 2479 ±11 |
| Ticks wasted (duplicates, forged stops) | 2400 ±65 | 1563 ±40 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 541 ±13 | 348 ±8 | 20.5 ±2.2 | 13.2 ±1.6 | 1.8 ±0.5 |
| Message reads (token cost) | 4028555 ±47537 | 10602 ±36 | 3478 ±7 | 4056 ±6 | 3480 ±8 |
| Approvals still queued | 0.0 | 0.0 | 11.4 ±3.1 | 0.8 ±0.5 | 795 ±10 |

### 3. 100 agents, 30 misaligned (20 seeds)

| Metric | board | hub | platform | platform+hub | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 2078 ±26 | 1832 ±15 | 3184 ±7 | 1892 ±5 | 2467 ±11 |
| Ticks wasted (duplicates, forged stops) | 1559 ±51 | 1525 ±50 | 0.0 | 0.0 | 0.0 |
| Bad risky actions executed | 648 ±13 | 408 ±8 | 47.6 ±3.5 | 27.2 ±3.1 | 2.3 ±0.6 |
| Message reads (token cost) | 3887255 ±43917 | 11273 ±54 | 3682 ±13 | 4184 ±10 | 3674 ±11 |
| Approvals still queued | 0.0 | 0.0 | 8.6 ±3.4 | 0.7 ±0.4 | 790 ±9 |

### 4. Honest agents only: the cost of the medium

| Metric | board, latency 0 | board, latency 1 | board, latency 3 | board, latency 10 | platform |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 638 ±1 | 637 ±1 | 634 ±2 | 617 ±2 | 652 ±1 |
| Ticks wasted (duplicates, forged stops) | 0.0 | 1.5 ±0.2 | 11.1 ±0.9 | 124 ±7 | 0.0 |
| Write conflicts | 0.0 | 1.6 ±0.2 | 5.4 ±0.5 | 23.7 ±0.9 | 0.0 |
| Message reads (token cost) | 43234 ±97 | 43220 ±98 | 43186 ±109 | 42578 ±104 | 670 ±1 |

### 5. Sensitivity: 50 draws of every rate × [0.5, 2] (20 agents: 10 seeds per draw; 100 agents: 3 seeds per draw)

| Conclusion | Holds in |
|---|---:|
| platform lands at least as much as board (within 2%) | 100% |
| platform executes fewer bad risky actions than board | 100% |
| platform executes fewer bad risky actions than hub | 98% |
| bad risky actions rank platform < hub < board | 94% |
| tasks landed rank platform > hub > board | 98% |
| hub wastes fewer ticks than board | 40% |
| signatures alone cut forged messages obeyed by half or more | 80% |
| every risky action to a person lands less than lanes | 88% |
| platform+hub lands less than platform at 100 agents | 100% |

