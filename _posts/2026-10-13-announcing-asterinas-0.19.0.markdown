---
layout: post
title:  "Announcing Asterinas 0.19.0"
date:   2026-10-13 09:00:00 +0800
author: "Hongliang Tian"
---

The [Asterinas](https://github.com/asterinas/asterinas) community is happy to announce a new version of Asterinas, [0.19.0](https://github.com/asterinas/asterinas/releases/tag/v0.19.0)!

Two milestones first. More than 100 people have now contributed to the Asterinas repository, and the codebase has passed 250,000 lines, about 200,000 of them Rust. Of those contributors, 55 worked on this release, 31 for the first time. Whether you landed a subsystem or fixed a typo, thank you.

This post covers the seven changes we think matter most. Everything else is in the [full changelog](https://github.com/asterinas/asterinas/blob/main/RELEASES.md).

- [Graphics](#graphics-a-drm-subsystem): Xorg and OpenGL games on a new DRM subsystem
- [Arm](#arm-aarch64-joins-as-the-fourth-architecture): AArch64 as a target, Arm machines as hosts
- [Secure containers](#secure-containers-a-better-guest-kernel): a better guest kernel for Kata-style VMs
- [Virtualization](#virtualization-hypervisor-support-in-ostd): hypervisor support in OSTD
- [Drivers](#drivers-a-rust-native-device-model): a Rust-native device model
- [AI code review](#ai-code-review-the-aster-code-review-skill): a review skill built on our coding guidelines
- [Self-hosting](#self-hosting-asterinas-builds-asterinas): Asterinas builds and boots Asterinas

## Graphics: a DRM subsystem

Asterinas NixOS can now run Xorg on its standard `modesetting` driver, with Mesa's software OpenGL on top, instead of the legacy framebuffer (fbdev) interface. Behind this is a new DRM (Direct Rendering Manager) subsystem, the kernel interface that modern Linux graphics stacks are built on. The new `aster-drm` component provides the DRM core, the device nodes under `/dev/dri`, GEM dumb buffers (CPU-drawn framebuffers that user space can `mmap`) and the KMS (kernel mode setting) objects that configure the display ([#3787](https://github.com/asterinas/asterinas/pull/3787), [#3925](https://github.com/asterinas/asterinas/pull/3925), [#3888](https://github.com/asterinas/asterinas/pull/3888), [#3941](https://github.com/asterinas/asterinas/pull/3941)).

Two 3D games, the shooter OpenArena and the kart racer SuperTuxKart, now run on Asterinas NixOS, as the demo video shows.

<video class="post-video" controls preload="metadata" playsinline>
<source src="/assets/videos/2026-10-10-v0.19.0-3d-gaming-demo.mp4" type="video/mp4">
Your browser does not play embedded video. <a href="/assets/videos/2026-10-10-v0.19.0-3d-gaming-demo.mp4">Download the demo (18 MB)</a>.
</video>

## Arm: AArch64 joins as the fourth architecture

Asterinas 0.19.0 adds AArch64 as its fourth CPU architecture, after x86-64, RISC-V and LoongArch ([#3737](https://github.com/asterinas/asterinas/pull/3737)). The port is minimal but usable. On QEMU's `virt` machine it brings up the GICv3 interrupt controller, the generic timer, the PL031 RTC, the PL011 UART and virtio-mmio devices, and runs a BusyBox shell complete with a vDSO, the kernel-provided fast path for calls such as `clock_gettime` ([#3884](https://github.com/asterinas/asterinas/pull/3884), [#3933](https://github.com/asterinas/asterinas/pull/3933)). AArch64 enters as a [Tier 2 platform](https://asterinas.github.io/book/kernel/), with CI coverage still growing.

Arm machines now work as development hosts too. The Docker images are published for `linux/arm64` alongside `linux/amd64`, and the new Nix development shell supports `aarch64-linux`, so an Arm laptop or server can build and run the kernel without an x86 box.

## Secure containers: a better guest kernel

Asterinas's near-term deployment target is the guest kernel of VM-based containers such as [Kata Containers](https://katacontainers.io/) and [Confidential Containers](https://confidentialcontainers.org/). A memory-safe guest kernel removes a whole class of exploitable bugs from the sandbox. Asterinas can already serve as that guest kernel, within limits, and 0.19.0 removes several of them.

- **Overlayfs, reimplemented.** Container images are stacks of layers, and overlayfs presents them as one filesystem. The new implementation ([#3795](https://github.com/asterinas/asterinas/pull/3795)) adds what the old one lacked, from rename to multiple lower layers and read-only overlays, and more than doubles the overlayfs cases it passes in xfstests, the standard Linux filesystem test suite.
- **Mount propagation and the new mount API.** Mounts can now be shared, slave, private or unbindable ([#3639](https://github.com/asterinas/asterinas/pull/3639)), and the fd-based `fsopen` family of syscalls works ([#3492](https://github.com/asterinas/asterinas/pull/3492)). Container runtimes and newer systemd use both to set up a sandbox's mounts.
- **virtio-fs, matured.** virtio-fs shares host directories with the VM. The driver gains `mmap`, `O_DIRECT`, rename, symbolic links and faster multi-page I/O, and xfstests now runs against it in CI ([#3730](https://github.com/asterinas/asterinas/pull/3730), [#3509](https://github.com/asterinas/asterinas/pull/3509), [#3334](https://github.com/asterinas/asterinas/pull/3334), [#3812](https://github.com/asterinas/asterinas/pull/3812), [#3886](https://github.com/asterinas/asterinas/pull/3886), [#3747](https://github.com/asterinas/asterinas/pull/3747)).
- **PVH boot and Firecracker.** Asterinas boots via PVH, the direct-boot protocol used by QEMU, Cloud Hypervisor and Firecracker ([#3765](https://github.com/asterinas/asterinas/pull/3765)), and runs as the guest kernel of a Firecracker microVM ([#3461](https://github.com/asterinas/asterinas/pull/3461)). The [Firecracker page](https://asterinas.github.io/book/kernel/firecracker.html) in the Asterinas Book shows how to try it.
- **Faster TDX boot.** In an Intel TDX guest, every page of memory must be accepted before the kernel can use it. Asterinas now splits that work across all vCPUs at boot instead of doing it on one ([#3640](https://github.com/asterinas/asterinas/pull/3640)). Booting a guest with 8 GiB of memory takes 25 seconds on one vCPU, 12 on four and 9 on eight.

## Virtualization: hypervisor support in OSTD

A bare-metal (Type 1) hypervisor such as Xen keeps its own core small, but leans on a full OS, usually Linux in dom0, for drivers and management. Linux with KVM is convenient but puts a large C kernel in every VM's trusted base. Asterinas aims to keep the convenience while shrinking what can go wrong: the only code that can break memory safety is OSTD, and the virtualization logic above it is safe Rust.

[RFC-0003](https://asterinas.github.io/book/rfcs/0003-hypervisor-support.html) sets the design. [OSTD](https://asterinas.github.io/book/ostd/), the framework beneath Asterinas, owns the mechanism: virtualization hardware state, second-stage address translation and the guest-host switch. The kernel owns the policy: VM and vCPU lifecycle, memory slots, interrupt chips, device emulation and, eventually, a KVM-compatible `/dev/kvm`. All the code that needs `unsafe` lives in OSTD's virtualization module, about 2,000 lines today, so everything above it, up to a complete hypervisor, can be safe Rust.

Asterinas 0.19.0 delivers the Intel VMX foundation: the VMX lifecycle ([#3675](https://github.com/asterinas/asterinas/pull/3675)), the VMCS ([#3833](https://github.com/asterinas/asterinas/pull/3833)), EPT-backed guest memory ([#3825](https://github.com/asterinas/asterinas/pull/3825)), the guest CPU state ([#3697](https://github.com/asterinas/asterinas/pull/3697)) and guest execution that returns each VM exit to the caller ([#3860](https://github.com/asterinas/asterinas/pull/3860)). The Book shows [how to use these APIs to write a minimal hypervisor in about 100 lines of safe Rust](https://asterinas.github.io/book/ostd/a-100-line-hypervisor.html). Safe Rust rules out memory-safety bugs there, not logic bugs: as long as OSTD's core is sound, buggy device emulation can misbehave but cannot corrupt host memory.

## Drivers: a Rust-native device model

Most of the code in a mature kernel is device drivers, so a kernel architecture has to scale in how it handles devices. User space cares too: systemd, udev and tools such as `lsblk` learn what hardware exists from `/sys` and `/dev`. Asterinas 0.19.0 puts the core of a device model in place: the new [`aster-device`](https://github.com/asterinas/asterinas/blob/ec5bb9ed798851b4c1854e791341321902ac8bc9/kernel/core/comps/device/src/lib.rs) component, a Rust-native counterpart of Linux's driver core, written entirely in safe Rust ([#3889](https://github.com/asterinas/asterinas/pull/3889)). It defines buses, classes, drivers and devices as typed abstractions, so that the type system enforces what Linux enforces by convention:

- **Buses and drivers.** A `Driver<B>` can only be registered on bus `B`, and its `on_probe` receives a `BusDevice<B>`, which dereferences to the bus's own device type. A PCI driver would read `dev.vendor_id` as a plain field, where a Linux driver casts a generic `struct device *` with `container_of`.
- **Classes and class devices.** A `ClassDevice<C>` carries its class in its type, so a `ClassObserver<C>` hears only about devices of class `C`. An observer of the block class that scans new disks for partitions can never be handed a terminal.
- **Attributes.** A sysfs attribute is an `Attr<D>`, declared against the device type `D` it belongs to (`D` may be a `BusDevice<B>` or a `ClassDevice<C>`), and its callbacks receive a `&D`. An attribute of one class cannot be attached to another class's devices, and no callback has to downcast a generic device pointer.

Registering a device is one call, and the rest follows: the model matches it with a driver and probes it, the right entries appear under `/sys/devices`, `/sys/bus`, `/sys/class` and `/sys/dev`, and the device node appears in `/dev`, kept up to date by the new devtmpfs ([#3621](https://github.com/asterinas/asterinas/pull/3621)).

The memory devices (`/dev/null`, `/dev/zero`, `/dev/random` and friends) are the first to be registered through the model. Existing drivers will migrate over the coming releases, and new ones will be built on it from the start.

The model lands alongside [a push for modularity](https://github.com/asterinas/asterinas/issues/3601). The kernel is now assembled from components, which can be turned on or off at build time. In the future, most device drivers will be added as components.

## AI code review: the `aster-code-review` skill

Agents make code cheap. Human review is the bottleneck that stays. To relieve the bottleneck, this release ships [`aster-code-review`](https://github.com/asterinas/asterinas/blob/ec5bb9ed798851b4c1854e791341321902ac8bc9/.agents/skills/aster-code-review/README.md), a skill for Claude Code or Codex that reviews a Git change or a set of files ([#3483](https://github.com/asterinas/asterinas/pull/3483)). The `aster-code-review` skill seeks to answer one question: how do you make an AI review like a maintainer? A maintainer makes objective calls, the clear-cut bugs, and subjective calls: does this change follow the project's conventions? Two features let the skill do both.

- **Grounded in guidelines.** Every subjective call cites the [Coding Guidelines](https://asterinas.github.io/book/to-contribute/coding-guidelines/), reorganized in this release around five reviewer personas into 81 guidelines with stable short names ([#3416](https://github.com/asterinas/asterinas/pull/3416)). The skill runs one pass per persona and tries to refute each comment before keeping it.
- **Optimized against a benchmark.** A suite of 58 review problems with 138 expected defects, almost all mined from Asterinas's own history, measures recall. Every miss drives a change to the guidelines or the skill.

<figure class="aster-fig" id="fig-codereview">
<div class="head">
<div class="tag">aster-code-review</div>
<div class="title">Reviewing like a maintainer takes a standard and a benchmark</div>
</div>
<svg class="d" viewBox="0 0 860 210" role="img" aria-label="Three boxes in a row. On the left, feature 1, the standard: the Coding Guidelines, 81 guidelines across 5 reviewer personas with stable short names. They ground every call of aster-code-review, the box in the middle, which runs one pass per persona, verifies each comment, and makes both objective and subjective calls. Its reviews are scored for recall by the box on the right, feature 2, the evidence: a benchmark of 58 problems with 138 defects from Asterinas history. A dashed arrow runs from the benchmark back to the guidelines: misses drive changes to the guidelines and the skill.">
<defs>
<linearGradient id="codereview-dg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" class="g0"/><stop offset="100%" class="g1"/></linearGradient>
<marker id="codereview-da" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk o" d="M0 0 L8 4 L0 8 z"/></marker>
<marker id="codereview-dn" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0 0 L8 4 L0 8 z"/></marker>
</defs>
<text class="cap faint" x="24" y="22" font-size="12">FEATURE 1 · THE STANDARD</text>
<text class="cap faint end" x="836" y="22" font-size="12">FEATURE 2 · THE EVIDENCE</text>
<rect class="tint" x="24" y="40" width="200" height="100" rx="6"/>
<text class="lbl mid" x="124" y="64">Coding Guidelines</text>
<g class="note mid" font-size="12"><text x="124" y="84">81 guidelines</text><text x="124" y="100">5 reviewer personas</text><text x="124" y="116">stable short names</text></g>
<path class="lo" d="M224 90 H328" marker-end="url(#codereview-da)"/>
<g class="note mid" font-size="12"><text x="276" y="66">grounds</text><text x="276" y="81">every call</text></g>
<rect class="o hi" x="330" y="40" width="200" height="100" rx="6" style="fill:url(#codereview-dg)"/>
<text class="ot mid" x="430" y="64">aster-code-review</text>
<g class="note mid" font-size="12"><text x="430" y="84">one pass per persona</text><text x="430" y="100">verify each comment</text><text x="430" y="116">objective + subjective</text></g>
<path class="lo" d="M530 90 H634" marker-end="url(#codereview-da)"/>
<g class="note mid" font-size="12"><text x="582" y="66">scored for</text><text x="582" y="81">recall</text></g>
<rect x="636" y="40" width="200" height="100" rx="6"/>
<text class="lbl mid" x="736" y="64">Benchmark</text>
<g class="note mid" font-size="12"><text x="736" y="84">58 problems, 138 defects</text><text x="736" y="100">from Asterinas history</text><text x="736" y="116">measures recall</text></g>
<path class="dash" d="M736 140 V174 H124 V142" marker-end="url(#codereview-dn)"/>
<text class="faint mid" x="430" y="196" font-size="12">misses drive changes to the guidelines and the skill</text>
</svg>
<svg class="m" viewBox="0 0 320 346" role="img" aria-label="Three boxes top to bottom. Feature 1, the Coding Guidelines: 81 guidelines across 5 reviewer personas with stable short names to cite. They ground every call of aster-code-review, which runs one pass per persona, then verifies, and makes objective and subjective calls. Its reviews are scored for recall by feature 2, a benchmark of 58 problems with 138 defects from Asterinas history. A dashed arrow runs from the benchmark back up to the guidelines: misses drive changes to the guidelines and the skill.">
<defs>
<linearGradient id="codereview-mg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" class="g0"/><stop offset="100%" class="g1"/></linearGradient>
<marker id="codereview-ma" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk o" d="M0 0 L8 4 L0 8 z"/></marker>
<marker id="codereview-mn" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk" d="M0 0 L8 4 L0 8 z"/></marker>
</defs>
<rect class="tint" x="10" y="22" width="300" height="72" rx="6"/>
<text class="lbl mid" x="160" y="42" font-size="12">1 · Coding Guidelines</text>
<g class="note mid" font-size="12"><text x="160" y="60">81 guidelines · 5 reviewer personas</text><text x="160" y="76">stable short names to cite</text></g>
<path class="lo" d="M160 94 V116" marker-end="url(#codereview-ma)"/>
<text class="note" x="168" y="108" font-size="12">grounds every call</text>
<rect class="o hi" x="10" y="118" width="300" height="72" rx="6" style="fill:url(#codereview-mg)"/>
<text class="ot mid" x="160" y="138" font-size="12">aster-code-review</text>
<g class="note mid" font-size="12"><text x="160" y="156">one pass per persona, then verify</text><text x="160" y="172">objective and subjective calls</text></g>
<path class="lo" d="M160 190 V212" marker-end="url(#codereview-ma)"/>
<text class="note" x="168" y="204" font-size="12">scored for recall</text>
<rect x="10" y="214" width="300" height="72" rx="6"/>
<text class="lbl mid" x="160" y="234" font-size="12">2 · Benchmark</text>
<g class="note mid" font-size="12"><text x="160" y="252">58 problems, 138 defects</text><text x="160" y="268">from Asterinas history · recall</text></g>
<path class="dash" d="M80 286 V302 H4 V58 H8" marker-end="url(#codereview-mn)"/>
<g class="faint mid" font-size="12"><text x="160" y="322">misses drive changes to</text><text x="160" y="337">the guidelines and the skill</text></g>
</svg>
<figcaption>Every call cites a guideline, and every miss on the benchmark becomes a change to the guidelines or the skill.</figcaption>
</figure>

## Self-hosting: Asterinas builds Asterinas

Building itself is a rite of passage for an operating system, and Asterinas 0.19.0 passes it. A new page in the [Asterinas Book](https://asterinas.github.io/book/), [Building Asterinas on Asterinas](https://asterinas.github.io/book/distro/building-on-asterinas.html), walks through the steps: boot Asterinas NixOS in a VM, clone the repository inside it, enter the Nix development shell, run `make kernel` and boot the freshly built kernel in a nested QEMU VM ([#3749](https://github.com/asterinas/asterinas/pull/3749)). Nix, Cargo, rustc and QEMU all run on Asterinas along the way, which makes a self-hosted build one of the largest real-world workloads the kernel has been put through.

The Nix development shell is new in this release too. The repository now ships a Nix flake as an alternative to Docker ([#3548](https://github.com/asterinas/asterinas/pull/3548)), with the toolchain, QEMU and firmware prebuilt on [Cachix](https://www.cachix.org/). With Nix installed, three commands take a fresh clone to a booted kernel:

```sh
nix develop
make kernel
make run_kernel
```

## Contributors

This release was made possible by contributions from 55 individuals. Thank you for your amazing work!

* Ruihan Li (145 commits)
* Chen Chengjun (52 commits)
* Jianfeng Jiang (42 commits)
* Qingsong Chen (40 commits)
* Bet4 (38 commits)
* li041 (36 commits)
* zjp (32 commits)
* Ray Lee (31 commits)
* Tao Su (30 commits)
* Linermao (24 commits)
* Marsman1996 (18 commits)
* Ruowen Qin (16 commits)
* Tate, Hongliang Tian (16 commits)
* WaterWhisperer (12 commits)
* Zhang Junyang (10 commits)
* le-monde-bleu (9 commits)
* Ya0rk (9 commits)
* co63oc (8 commits)
* Hsy-Intel (8 commits)
* volca (7 commits)
* zzj-5341 (7 commits)
* Duck Ran (6 commits)
* Endlia (6 commits)
* Halifuda (6 commits)
* harry (6 commits)
* Junrui Luo (6 commits)
* Mohammad Razeghi (6 commits)
* FallingLeavez (5 commits)
* Fan Jie (5 commits)
* Cautreoxit (4 commits)
* androidAppGuard (3 commits)
* Jia Qingtong (3 commits)
* Xinyi Yu (3 commits)
* Zhouqi Jiang (3 commits)
* Bitter127 (2 commits)
* Junjie Cao (2 commits)
* Martin Holovsky (2 commits)
* Mike Solar (2 commits)
* QcN3ep (2 commits)
* TankTechnology (2 commits)
* wangyue789 (2 commits)
* wheatfox (2 commits)
* WX Chen (2 commits)
* Zhihang Shao (2 commits)
* aiqubits (1 commit)
* Boyang Xue (1 commit)
* Haixin Xu (1 commit)
* Philipp Schuster (1 commit)
* rikosellic (1 commit)
* Shen Bowen (1 commit)
* Shi Lei (1 commit)
* Wang Yue (1 commit)
* yanchaomei (1 commit)
* YanLien (1 commit)
* 刘景宇 (1 commit)
