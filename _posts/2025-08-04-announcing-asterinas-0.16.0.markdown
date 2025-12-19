---
layout: post
title:  "Announcing Asterinas 0.16.0"
date:   2025-08-04 21:00:00 +0800
author: "Hongliang Tian"
---

The Asterinas community is happy to announce a new version of Asterinas, 0.16.0!

This version marks a significant leap forward with initial support for the **LoongArch CPU architecture**. We've also greatly expanded our Linux ABI compatibility by adding **nine new system calls**, including `memfd_create` and `pidfd_open`.

Key enhancements in this release include broadened functionality for **UNIX sockets** (now supporting file descriptor passing and the `SOCK_SEQPACKET` socket type), partial support for **netlink sockets of the `NETLINK_KOBJECT_UEVENT` type**, and the foundational implementation of **CgroupFS**. Our testing infrastructure has also seen a significant upgrade with the integration of system call tests from the **Linux Test Project (LTP)**. Plus, we've adopted **[Nix](https://nix.dev/manual/nix/2.28/introduction)** for building the initramfs, which streamlines our cross-compilation and testing workflows.

We'd also like to extend a huge congratulations to members of the Asterinas community whose outstanding research papers about Asterinas were recently accepted by prestigious academic conferences:

* "**Asterinas: A Linux ABI-Compatible, Rust-Based Framekernel OS with a Small and Sound TCB**" published at [USENIX ATC'25](https://www.usenix.org/conference/atc25/presentation/peng-yuke)
* "**Converos: Practical Model Checking for Verifying Rust OS Kernel Concurrency**" published at [USENIX ATC'25](https://www.usenix.org/conference/atc25/presentation/tang)
* "**CortenMM: Efficient Memory Management with Strong Correctness Guarantees**" to be published at [SOSP'25](https://sigops.org/s/conferences/sosp/2025/)

## Demo: Booting on a Lenovo Laptop

While our early development has primarily focused on improving Asterinas for cloud environments and VMs, the enhancements in version 0.16.0 have allowed us to achieve a significant new feat: successfully booting Asterinas on a **Lenovo laptop** and even running a snake game!

<div class="video-container">
    <iframe src="https://player.bilibili.com/player.html?isOutside=true&aid=114970301828426&bvid=BV1KntGzvEh8&cid=31482972390&p=1&autoplay=0"
            scrolling="no"
            border="0"
            frameborder="no"
            framespacing="0"
            allowfullscreen="true">
    </iframe>
</div>

A special shout-out to Ruihan Li for his excellent work in [making this happen](https://github.com/asterinas/asterinas/issues/1963) and capturing the demo video!

## Asterinas Kernel

We have made the following key changes to the Asterinas kernel:

* New system calls or features:
    * Memory:
        * [Add the `mremap` system call](https://github.com/asterinas/asterinas/pull/2162)
        * [Add the `memfd_create` system call](https://github.com/asterinas/asterinas/pull/2149)
        * [Add the `msync` system call (based on an inefficient implementation)](https://github.com/asterinas/asterinas/pull/2154)
    * Processes and IPC:
        * [Add the `pidfd_open` system call along with the `CLONE_PIDFD` flag](https://github.com/asterinas/asterinas/pull/2151)
    * File systems and I/O in general:
        * [Add the `close_range` system call](https://github.com/asterinas/asterinas/pull/2128)
        * [Add the `fadvise64` system call (dummy implementation)](https://github.com/asterinas/asterinas/pull/2125)
        * [Add the `ioprio_get` and `ioprio_set` system calls (dummy implementation)](https://github.com/asterinas/asterinas/pull/2126)
        * [Add the `epoll_pwait2` system call](https://github.com/asterinas/asterinas/pull/2123)
* Enhanced system calls or features:
    * Processes:
        * [Add `FUTEX_WAKE_OP` support for the `futex` system call](https://github.com/asterinas/asterinas/pull/2146)
        * [Add `WSTOPPED` and `WCONTINUED` support to the `wait4` and `waitpid` system calls](https://github.com/asterinas/asterinas/pull/2166)
        * [Add more fields in `/proc/*/stat` and `/proc/*/status`](https://github.com/asterinas/asterinas/pull/2215)
    * File systems and I/O in general:
        * [Add a few more features for the `statx` system call](https://github.com/asterinas/asterinas/pull/2127)
        * [Fix partial writes and reads in writev and readv](https://github.com/asterinas/asterinas/pull/2230)
        * [Introduce `FsType` and `FsRegistry`](https://github.com/asterinas/asterinas/pull/2267)
    * Sockets and network:
        * [Enable UNIX sockets to send and receive file descriptors](https://github.com/asterinas/asterinas/pull/2176)
        * [Support `SO_PASSCRED` & `SCM_CREDENTIALS` & `SOCK_SEQPACKET` for UNIX sockets](https://github.com/asterinas/asterinas/pull/2268)
        * [Add `NETLINK_KOBJECT_UEVENT` support for netlink sockets (a partial implementation)](https://github.com/asterinas/asterinas/pull/2109)
        * [Support some missing socket options for UNIX stream sockets](https://github.com/asterinas/asterinas/pull/2192)
        * [Truncate netlink messages when the user-space buffer is full](https://github.com/asterinas/asterinas/pull/2155)
        * [Fix the networking address reusing behavior (`SO_REUSEADDR`)](https://github.com/asterinas/asterinas/pull/2277)
    * Security:
        * [Add basic cgroupfs implementation](https://github.com/asterinas/asterinas/pull/2121)
* New device support:
    * [Add basic i8042 keyboard support](https://github.com/asterinas/asterinas/pull/2054)
* Enhanced device support:
    * TTY
        * [Refactor the TTY abstraction to support multiple I/O devices correctly](https://github.com/asterinas/asterinas/pull/2108)
        * [Enhance the framebuffer console to support ANSI escape sequences](https://github.com/asterinas/asterinas/pull/2210)
* Test infrastructure:
    * [Introduce the system call tests from LTP](https://github.com/asterinas/asterinas/pull/2053)
    * [Use Nix to build initramfs](https://github.com/asterinas/asterinas/pull/2101)

## OSTD & OSDK

We have made the following key changes to OSTD:

* CPU architectures:
    * x86-64:
        * [Refactor floating-point context management in context switching and signal handling](https://github.com/asterinas/asterinas/pull/2219)
        * [Use iret instead of sysret if the context is not clean](https://github.com/asterinas/asterinas/pull/2271)
        * [Don't treat APIC IDs as CPU IDs](https://github.com/asterinas/asterinas/pull/2091)
        * [Fix some CPUID problems and add support for AMD CPUs](https://github.com/asterinas/asterinas/pull/2273)
    * RISC-V:
        * [Add RISC-V timer support](https://github.com/asterinas/asterinas/pull/2044)
        * [Parse device tree for RISC-V ISA extensions](https://github.com/asterinas/asterinas/pull/2113)
    * LoongArch:
        * [Add the initial LoongArch support](https://github.com/asterinas/asterinas/pull/2260)
* CPU:
    * [Add support for dynamically‌-allocated CPU-local objects](https://github.com/asterinas/asterinas/pull/2036)
    * [Require `T: Send` for `CpuLocal<T, S>`](https://github.com/asterinas/asterinas/pull/2171)
* Memory management:
    * [Adopt a two-phase locking scheme for page tables](https://github.com/asterinas/asterinas/pull/1948)
* Trap handling:
    * [Create `IrqChip` abstraction](https://github.com/asterinas/asterinas/pull/2107)
* Task and scheduling:
    * [Rewrite the Rust doc of OSTD's scheduling module](https://github.com/asterinas/asterinas/pull/2284)
    * [Fix the race between enabling IRQs and halting CPU](https://github.com/asterinas/asterinas/pull/2052)
* Test infrastructure:
    * [Add CI to check documentation and publish API documentation to a self-host website](https://github.com/asterinas/asterinas/pull/2218)

We have made the following key changes to OSDK:

* [Add OSDK's code coverage feature](https://github.com/asterinas/asterinas/pull/2203)
* [Support `cargo osdk test` for RISC-V](https://github.com/asterinas/asterinas/pull/2168)

## Contributors

This release was made possible by contributions from 21 individuals. Thank you for your amazing work!

* Ruihan Li (81 commits)
* Qingsong Chen (31 commits)
* jiangjianfeng (29 commits)
* 王英泰 (28 commits)
* Chen Chengjun (24 commits)
* Zhang Junyang (24 commits)
* Wang Siyuan (16 commits)
* Marsman1996 (13 commits)
* Cautreoxit (8 commits)
* Hsy-Intel (6 commits)
* Zejun Zhao (5 commits)
* Yang Zhichao (4 commits)
* Hongliang Tian (3 commits)
* js2xxx (3 commits)
* Wei Zhang (2 commits)
* Yuke Peng (2 commits)
* Philipp Schuster (1 commit)
* Ruize Tang (1 commit)
* YanWQ-monad (1 commit)
* stuuupidcat (1 commit)
* yuankunzhang (1 commit)

---

We're incredibly proud of the progress made in Asterinas 0.16.0 and are excited about the new possibilities these changes unlock. We encourage you to explore the new features and contribute to the ongoing development!
