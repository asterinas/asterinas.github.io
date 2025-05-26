---
layout: post
title:  "Kernel Memory Safety: Mission Accomplished"
date:   2025-06-04 17:00:00 +0800
author: "Hongliang Tian"
---

(Forword: This post distills our research paper _Asterinas: A Linux ABI-Compatible, Rust-Based Framekernel OS with a Small and Sound TCB_, which is to be published at [USENIX ATC 2025](https://www.usenix.org/conference/atc25/technical-sessions). The preprint can be found on [arXiv](https://arxiv.org/abs/2506.03876).)

Less than one year ago, on July 19, 2024, millions of Windows desktops, servers, and devices suddenly crashed with the infamous "blue screen of death". This global incident—now known as [the CrowdStrike outage](https://en.wikipedia.org/wiki/2024_CrowdStrike-related_IT_outages)—was triggered by a memory-safety bug in a Windows driver: an out-of-bounds access. It was a sobering reminder that even mature, commercial off-the-shelf operating systems (OSes) like Windows and Linux remain vulnerable to memory-safety flaws.

Two years before the CrowdStrike outage, around mid-2022, we began asking: **could Rust finally solve the problem of kernel memory safety?** Not partially. Not with guardrails. But completely.

That was when we came up with this idea of a new OS architecture called **framekernel**, designed to unlock the full potential of Rust by confining `unsafe` code to a minimal, auditable scope within the kernel. The idea was bold but simple:

> What if we could build an entire OS kernel where **everything but a small trusted core is written in safe Rust**?

From this idea, [**the Asterinas project**](https://github.com/asterinas/asterinas) was born—the first real-world implementation of a framekernel. We didn't know if it would work. 

1. How *small* can the TCB be?
2. Is this too restrictive for _rich_ OS features?
3. Would *performance* suffer?
4. Are memory-safety _bugs_ really gone?

After three years of development and over 100,000 lines of Rust, Asterinas has grown from a research prototype into a maturing system—with real-world use on the horizon. We've seen enough, built enough, and tested enough to say this with confidence:

> Kernel memory safety has been accomplished — with no compromises.

We proved that an OS kernel with rich functionality, Linux compatibility, and competitive performance can be built entirely in safe Rust, atop a small and sound OS framework. We built such a framework, which is called **OSTD**.

In this post, we'll give you a lightning tour of the framekernel architecture—and show how OSTD and Asterinas brings it to life.

## Framekernel 101

The framekernel combines the best of both worlds:

> The performance of a monolithic kernel and the security of a microkernel.

A framekernel lives in a single address space (like a monolithic kernel), but is **logically partitioned**:

* The **_privileged_ OS framework** is a small, rigorously-verified mix of safe and unsafe Rust code that encapsulates low-level, unsafe operations into high-level, safe abstractions.
* The **_de-privileged_ OS services**, written entirely in safe Rust atop the framework's abstractions, implement the bulk of OS functionality—device drivers, filesystems, networking, and more.

This **language-based, intra-kernel privilege separation** means that the memory safety of the entire OS kernel only depends on the correctness of the tiny privileged OS framework. Communication between different parts of the OS remains fast—via ordinary function calls and shared memory—preserving monolithic speed while enabling microkernel-like safety.

A comparison between the three OS architectures is summarized in the following figure (extracted from the paper):

![Kernel Architecture Comparison](/assets/images/monolithic-kernel-vs-microkernel-vs-framekernel.png)
(TCB is short for Trusted Computing Base, which is the code responsible for kernel memory safety.)

## Your "Hello, World" Framekernel

Let's see a real example: handling system calls.

As mentioned, the OS framework for Asterinas is called OSTD. We position it as Rust's (unofficial) standard library for OS development, and it has been published to [crates.io](https://crates.io/crates/ostd). OSTD has been used for developing Asterinas and may be used for more Rust-based OSes. The following diagram (extracted from the paper) shows how system call loop may be written entirely in safe Rust using the API of OSTD.

![Handling System Calls with OSTD](/assets/images/handling-system-calls-with-ostd.png)

This example uses four safe abstractions from OSTD:

1. **`Task`** – Handles context switching and kernel stacks.
2. **`UserMode`** – Allows the CPU to execute in the user mode until an event occurs.
3. **`UserContext`** – Manipulates the user-mode CPU state such as general-purpose registers.
4. **`VmSpace`** – Manages user virtual memory safely.

All these abstractions wrap `unsafe` Rust code behind safe and sound APIs. The result: developing a Rust kernel can be as safe and productive as doing Rust applications.

For a fully working example, check out this sample project: [Write a Hello World kernel in 100 lines of safe Rust](https://asterinas.github.io/book/ostd/a-100-line-kernel.html).

## Soundness Is Hard—But Possible

Rust's promise of memory safety means **no [undefined behaviors (UBs)](https://doc.rust-lang.org/reference/behavior-considered-undefined.html)**. But UBs in a kernel aren't just a language issue—they can stem from:

- Compromised CPU states
- Bad page tables
- Corrupted stack
- Faulty DMA devices
- And more...

To uphold Rust’s guarantees, the TCB (i.e., OSTD) must defend against all of these threats. Even in the presence of hostile user programs, buggy drivers, or malicious peripherals, OSTD must ensure the absence of undefined behavior (UB)—a property known in Rust as **soundness**.

We achieve soundness by:
- Defining strict safety invariants for OSTD's APIs
- Using MMU and IOMMU hardware enforcement
- Reviewing `unsafe` code rigorously
- Running Miri (a Rust UB detector) on kernel code, with kernel-specific adaptations

More details can be found in the paper.

Thanks to the small TCB, the memory safety of the entire Asterinas framekernel is amenable to formal verification. Our goal is to verify all critical modules in OSTD using [Verus](https://github.com/verus-lang/verus). You can track our current progress in [a previous blog post](https://asterinas.github.io/2025/02/13/towards-practical-formal-verification-for-a-general-purpose-os-in-rust.html).

## A Vision Becomes Reality

After three years of development, we can now answer our original questions:

> How *small* can the TCB be?

Our TCB (OSTD) is approximately 15,000 lines of code—just 14% of the whole Asterinas kernel. In absolute terms, this is comparable to verified microkernels like [seL4](https://dl.acm.org/doi/10.1145/2560537) (~10K LoC), while commodity monolithic kernels (including [Rust for Linux](https://www.usenix.org/conference/atc24/presentation/li-hongyu)) have TCBs that are orders of magnitude larger. Relatively speaking, Asterinas also outperforms other Rust-based OSes: [Tock](https://github.com/tock/tock) (43%), [RedLeaf](https://github.com/mars-research/redleaf) (66%), and [Theseus](https://github.com/theseus-os/Theseus) (62%) all have significantly larger TCB proportions.

> Is this too restrictive for _rich_ OS features?

No. Currently, Asterinas supports:

- 210+ Linux system calls
- x86-64 & RISC-V CPU architectures
- Various file systems: Ext2, RamFS, SysFS, and OverlayFS
- Multiple sockets: TCP, UDP, Unix, and Netlink
- Multiple devices: Virtio, NVMe, and USB

Working in safe Rust is like dancing in chains: the constraints are real, but with enough discipline, the dance is still graceful.

> Would *performance* suffer?

Minimal. Asterinas is highly optimized, matching Linux's performance on the syscall-intensive [LMbench](https://github.com/intel/lmbench) microbenchmarks in the single-core setting. Multi-core scalability is actively being improved. Perhaps the biggest performance challenge we faced is efficient IOMMU management—a hurdle we overcame with a static mapping strategy.

> Are memory-safety _bugs_ really gone?

Almost. Asterinas contributors build features in **100% safe Rust**. Only OSTD developers touch `unsafe`, which is thoroughly reviewed and verified. Combined with **Miri** and **Verus**, the result is a kernel in which we have great confidence.

## This Is Just the Beginning

The framekernel architecture proves that memory-safe OSes aren't just possible—they're practical. **Asterinas is living proof.**

But this is just the beginning.

Now that memory safety is effectively solved, we can shift our focus to bugs beyond safety. For example, **Converos**—another project from the Asterinas community and [published at USENIX ATC 2025](https://www.usenix.org/conference/atc25/technical-sessions)—demonstrates how model checking can uncover hard-to-find concurrency bugs in Asterinas. Looking ahead, we envision leveraging Rust's strong, expressive type system to prevent logic errors and enable lightweight formal verification of critical OS properties. This direction is also [being explored by other Rust OS developers](https://arxiv.org/pdf/2501.00248).

As a relatively new kernel, Asterinas is not yet production-ready. In 2025, we will add support for Linux namespaces and cgroups—key features for server applications. We’re also working on a graphics subsystem to enable desktop scenarios. Before year’s end, we aim to complete a comprehensive device model. Support for the ARM architecture is planned as well.

Asterinas is an open-source project, and we welcome contributors of all kinds—developers, documenters, driver writers, testers—your help is invaluable. Head over now to star the repo and get involved:
[https://github.com/asterinas/asterinas](https://github.com/asterinas/asterinas)

Let’s make memory safety the new standard—together.