---
layout: post
title:  "Announcing Asterinas 0.17.0"
date:   2025-12-19 09:00:00 +0800
author: "Hongliang Tian"
---

The [Asterinas](https://github.com/asterinas/asterinas) community is happy to announce a new version of Asterinas, [0.17.0](https://github.com/asterinas/asterinas/releases/tag/v0.17.0)!

<div class="video-container">
    <iframe src="//player.bilibili.com/player.html?isOutside=true&aid=115707140442459&bvid=BV1oom2B2EqP&cid=34699609375&p=1&autoplay=0"
            scrolling="no"
            border="0"
            frameborder="no"
            framespacing="0"
            allowfullscreen="true">
    </iframe>
</div>

This release marks a significant milestone in the evolution of Asterinas as we transition from "just a kernel" to a more complete, usable system. The headline of this release is the introduction of **Asterinas NixOS**, our first distribution that integrates the Asterinas kernel with the [NixOS](https://nixos.org/) userspace, and enables real applications and services out of the box—including **XFCE**, **Podman**, and **systemd**. To support this growth, we are also strengthening our governance by establishing **the formal RFC (Request for Comments) process**, ensuring that major architectural decisions—starting with Asterinas NixOS itself—are designed transparently and collaboratively.

On the architecture front, **RISC-V support** has improved dramatically, with support for SMP (Symmetric Multiprocessing), FPU (Floating-Point Unit), VirtIO, and the SiFive HiFive Unleashed QEMU machine type. The kernel has also expanded with a new **input subsystem** (supporting keyboards and mice) and initial support for **namespaces and cgroups**. For filesystem developers, the big news is the addition of an **FS event notification mechanism (`inotify`)**, a new **ioctl infrastructure**, and a new filesystem type, **ConfigFS**. Finally, we are introducing **`sctrace`**—a dedicated tool for tracing and debugging syscall compatibility—now published on [crates.io](https://crates.io/crates/sctrace).

We'd also like to extend a huge congratulations to members of the Asterinas community whose outstanding research papers about Asterinas were recently recognized by prestigious academic conferences:

* "**CortenMM: Efficient Memory Management with Strong Correctness Guarantees**" received the Best Paper Award at [SOSP'25](https://sigops.org/s/conferences/sosp/2025/).
* "**RusyFuzz: Unhandled Exception Guided Fuzzing for Rust OS Kernel**" was accepted by [ICSE'26](https://conf.researchr.org/home/icse-2026).
* "**MlsDisk: Trusted Block Storage for TEEs Based on Layered Secure Logging**" was accepted by [FAST'26](https://www.usenix.org/conference/fast26).

## Asterinas NixOS

We have made the following key changes to Asterinas NixOS:

* [Add NixOS as a distribution for Asterinas](https://github.com/asterinas/asterinas/pull/2621)
* [Add the XFCE Nix module](https://github.com/asterinas/asterinas/pull/2670)
* [Add the Podman Nix module](https://github.com/asterinas/asterinas/pull/2683)
* [Enable systemd](https://github.com/asterinas/asterinas/pull/2687)
* [Add Asterinas NixOS ISO installer](https://github.com/asterinas/asterinas/pull/2652)
* [Add Cachix as a source for pre-built binaries](https://github.com/asterinas/asterinas/pull/2685)
* [Add GitHub workflows to publish ISO images](https://github.com/asterinas/asterinas/pull/2743)

## Asterinas Kernel

We have made the following key changes to the Asterinas kernel:

* CPU architectures:
    * x86
        * [Add TSM-based attestation support for TDX via ConfigFS](https://github.com/asterinas/asterinas/pull/2505)
    * RISC-V
        * [Implement arch-aware vDSO](https://github.com/asterinas/asterinas/pull/2319)
        * [Add VirtIO support for RISC-V platforms](https://github.com/asterinas/asterinas/pull/2299)
* Memory management
    * [Support sealing memfd files](https://github.com/asterinas/asterinas/pull/2408)
    * [Support executing memfd files and then `open("/proc/self/exe")`](https://github.com/asterinas/asterinas/pull/2521)
* Process management
    * [Support `CLONE_PARENT` flag](https://github.com/asterinas/asterinas/pull/2447)
    * [Support `execve` in multithreaded process](https://github.com/asterinas/asterinas/pull/2459)
    * [Support `PR_SET`/`GET_SECUREBITS`](https://github.com/asterinas/asterinas/pull/2551)
    * [Fix some `kill`-related behavior](https://github.com/asterinas/asterinas/pull/2516)
* IPC
    * [Add `rt_sigtimedwait` syscall](https://github.com/asterinas/asterinas/pull/2705)
    * [Enqueue ignored signals if the signals are blocked](https://github.com/asterinas/asterinas/pull/2503)
    * [Refactor `NamedPipe` to correct its opening and blocking behaviors](https://github.com/asterinas/asterinas/pull/2434)
    * [Support reopening anonymous pipes from `/proc`](https://github.com/asterinas/asterinas/pull/2694)
    * [Fix or clarify some futexes bugs](https://github.com/asterinas/asterinas/pull/2515)
* File systems
    * VFS
        * [Add `inotify`-related syscalls](https://github.com/asterinas/asterinas/pull/2083)
        * [Add new ioctl infrastructure](https://github.com/asterinas/asterinas/pull/2686)
        * [Add `chmod` and `mkmod` macros](https://github.com/asterinas/asterinas/pull/2440)
        * [Add `syncfs` syscall](https://github.com/asterinas/asterinas/pull/2682)
        * [Add `fchmodat2` syscall](https://github.com/asterinas/asterinas/pull/2666)
        * [Support mount bind with a file](https://github.com/asterinas/asterinas/pull/2418)
        * [Support `MS_REMOUNT` flag](https://github.com/asterinas/asterinas/pull/2432)
        * [Ensure that every `FileLike` is associated with a `dyn Inode`](https://github.com/asterinas/asterinas/pull/2555)
    * Devtmpfs
        * [Add `/dev/full` device](https://github.com/asterinas/asterinas/pull/2439)
        * [Support registering char devices](https://github.com/asterinas/asterinas/pull/2598)
        * [Support registering block device (and their partitions)](https://github.com/asterinas/asterinas/pull/2560)
    * Procfs
        * Add [`/proc/cmdline`](https://github.com/asterinas/asterinas/pull/2420), [`/proc/stat`, `/proc/uptime`](https://github.com/asterinas/asterinas/pull/2370), [`/proc/version`](https://github.com/asterinas/asterinas/pull/2679), [`/proc/[pid]/environ`](https://github.com/asterinas/asterinas/pull/2371), [`/proc/[pid]/oom_score_adj`](https://github.com/asterinas/asterinas/pull/2410), [`/proc/[pid]/cmdline`, `/proc/[pid]/mem`](https://github.com/asterinas/asterinas/pull/2449), [`/proc/[pid]/mountinfo`](https://github.com/asterinas/asterinas/pull/2399), [`/proc/[pid]/fdinfo`](https://github.com/asterinas/asterinas/pull/2526), and [`/proc/[pid]/maps`](https://github.com/asterinas/asterinas/pull/2725)
        * [Support the sleeping and stopping states in `/proc/[pid]/stat`](https://github.com/asterinas/asterinas/pull/2491)
        * [Introduce `VmPrinter`](https://github.com/asterinas/asterinas/pull/2414) and [refactor procfs with `VmPrinter`](https://github.com/asterinas/asterinas/pull/2583)
        * [Fix a lot of bugs in procfs](https://github.com/asterinas/asterinas/pull/2553)
    * Ext2
        * [Support Ext2 handling of FIFO and devices](https://github.com/asterinas/asterinas/pull/2658)
        * [Fix Ext2 directory entry iteration](https://github.com/asterinas/asterinas/pull/2624)
        * [Fix the behavior of syncing BlockGroup metadata in Ext2](https://github.com/asterinas/asterinas/pull/2611)
        * [Fix some bugs in Ext2 superblock](https://github.com/asterinas/asterinas/pull/2675)
    * Configfs
        * [Add basic configfs implementation](https://github.com/asterinas/asterinas/pull/2186)
* Sockets and networking
    * [Support UNIX datagram sockets](https://github.com/asterinas/asterinas/pull/2412)
    * [Add `sendmmsg` syscall](https://github.com/asterinas/asterinas/pull/2676)
    * [Add `sethostname` and `setdomainname` syscalls](https://github.com/asterinas/asterinas/pull/2442)
    * [Support `SO_BROADCAST` and `IP_RECVERR`](https://github.com/asterinas/asterinas/pull/2572)
* Namespace and cgroups
    * [Add the namespace framework (along with `unshare` and `setns` syscalls)](https://github.com/asterinas/asterinas/pull/2312)
    * [Add the mount namespace](https://github.com/asterinas/asterinas/pull/2379)
    * [Support `/proc/[pid]/uid_map` and `/proc/[pid]/gid_map`](https://github.com/asterinas/asterinas/pull/2454)
    * [Implement controller framework for cgroup subsystem](https://github.com/asterinas/asterinas/pull/2282)
    * [Enable process management for cgroups](https://github.com/asterinas/asterinas/pull/2160)
* Devices
    * Input devices
        * [Add the input subsystem](https://github.com/asterinas/asterinas/pull/2364)
        * [Map the I/O memory to the userspace](https://github.com/asterinas/asterinas/pull/2099)
        * [Add the input devices `/dev/input/eventX`](https://github.com/asterinas/asterinas/pull/2561)
        * [Add the framebuffer device `/dev/fb0`](https://github.com/asterinas/asterinas/pull/2216)
        * [Add i8042 mouse](https://github.com/asterinas/asterinas/pull/2479)
        * [Make i8042 initialization stable on real hardware](https://github.com/asterinas/asterinas/pull/2646) 
    * TTY and PTY
        * [Add `KDSETMODE`/`KDSKBMODE` ioctls](https://github.com/asterinas/asterinas/pull/2525)
        * [Fix PTY closing behavior](https://github.com/asterinas/asterinas/pull/2550)
        * [Make PTY master reads block if no PTY slave is open](https://github.com/asterinas/asterinas/pull/2581)
        * [Make the semantics of TTY-related devices correct](https://github.com/asterinas/asterinas/pull/2566)
        * [Support PTY packet mode](https://github.com/asterinas/asterinas/pull/2594)
* System management
    * [Add `reboot` syscall](https://github.com/asterinas/asterinas/pull/2552)
    * [Make `reboot -f` work on real hardware](https://github.com/asterinas/asterinas/pull/2636)
    * [Support `RUSAGE_CHILDREN` for `getrusage`](https://github.com/asterinas/asterinas/pull/2438)
* Misc
    * [Upgrade to Rust 2024 edition and the 20251208 nightly toolchain](https://github.com/asterinas/asterinas/pull/2701)
    * [Introduce the ASCII art of Asterinas logo in gradient colors](https://github.com/asterinas/asterinas/pull/2427)
    * [Add stage support for `init_component` macro](https://github.com/asterinas/asterinas/pull/2415)
    * [Add a new tool called Syscall Compatibility Tracer (`sctrace`)](https://github.com/asterinas/asterinas/pull/2456)

## Asterinas OSTD & OSDK

We have made the following key changes to OSTD and/or OSDK:

* CPU architectures
    * Common
        * [Reorganize `ostd::arch::irq`](https://github.com/asterinas/asterinas/pull/2504)
    * x86
        * [Better x86 CPU feature detection by rewriting all CPUID-related code](https://github.com/asterinas/asterinas/pull/2395)
        * [Set `CR0.WP/NE/MP` explicitly to fix AP behavior](https://github.com/asterinas/asterinas/pull/2422)
        * [Extend cache policies for the x86 Architecture](https://github.com/asterinas/asterinas/pull/2570)
    * RISC-V
        * [Add support for RISC-V PLIC](https://github.com/asterinas/asterinas/pull/2106)
        * [Refactor RISC-V trap handling](https://github.com/asterinas/asterinas/pull/2318)
        * [Add RISC-V FPU support](https://github.com/asterinas/asterinas/pull/2320)
        * [Implement fallible memory operations on RISC-V platform](https://github.com/asterinas/asterinas/pull/2462)
        * [Support bootup on SiFive HiFive Unleashed](https://github.com/asterinas/asterinas/pull/2481)
        * [RISC-V SMP boot](https://github.com/asterinas/asterinas/pull/2368)
        * [Full (<=32) RISC-V SMP support](https://github.com/asterinas/asterinas/pull/2547)
* CPU
    * [Extract `CpuId` into a dedicated sub-module](https://github.com/asterinas/asterinas/pull/2514)
* Memory management
    * [Make `UniqueFrame::repurpose` sound](https://github.com/asterinas/asterinas/pull/2441)
* Interrupt handling
    * [Refactor OSTD's `irq` module for improved clarity](https://github.com/asterinas/asterinas/pull/2429)
* Misc
    * [Move PCI bus out of OSTD](https://github.com/asterinas/asterinas/pull/2027)

## Asterinas Book

We have made the following key changes to the Book:

* [Add the first RFC: "Establish the RFC process"](https://github.com/asterinas/asterinas/pull/2365)
* [Add the second RFC: "Asterinas NixOS"](https://github.com/asterinas/asterinas/pull/2584)
* [Add a new "Limitations on System Calls" section to the book](https://github.com/asterinas/asterinas/pull/2314)
* [Add the Asterinas NixOS volume](https://github.com/asterinas/asterinas/pull/2750)

## Contributors

This release was made possible by contributions from 27 individuals. Thank you for your amazing work!

* Ruihan Li (164 commits)
* Chen Chengjun (90 commits)
* jiangjianfeng (69 commits)
* Zejun Zhao (45 commits)
* Wang Siyuan (45 commits)
* Tao Su (44 commits)
* Zhang Junyang (43 commits)
* Tate, Hongliang Tian (34 commits)
* Qingsong Chen (21 commits)
* Yuke Peng (19 commits)
* Zhe Tang (18 commits)
* vvsv (16 commits)
* Hsy-Intel (15 commits)
* Cautreoxit (13 commits)
* Yang Zhichao (8 commits)
* Arthur Paulino (8 commits)
* wyt8 (5 commits)
* Zhenchen Wang (5 commits)
* Wei Zhang (5 commits)
* zjp (4 commits)
* Chaoqun Zheng (2 commits)
* zhuowei shao (1 commit)
* wheatfox (1 commit)
* Ruize Tang (1 commit)
* John Hughes (1 commit)
* Hang Shu (1 commit)
* Calvin (1 commit)
