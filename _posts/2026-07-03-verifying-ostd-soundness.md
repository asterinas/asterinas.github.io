---
layout: post
title: "Proving Soundness for Unsafe Rust: Lessons from an OS Kernel"
date: 2026-07-03 09:00:00 +0800
author: "Asterinas Team and CertiK"
categories: [formal-verification, rust, kernel]
tags: [unsafe, soundness, verus, ostd, asterinas]
---

**TL;DR:** After a year and a half of work, the core memory-management API of the Asterinas kernel is
formally proven **sound** — no safe caller can drive it into undefined behavior, in any order, with any arguments.

- **What it covers.** The virtual memory subsystem of `mm`, from physical memory management up to virtual address spaces.
- **What it costs.** Roughly 6,000 lines of `unsafe`-heavy kernel code in two person-years. A proof-to-code ratio of about 5:1, compared to the 10:1 or even 20:1 that has historically been necessary.
- **Who should read on.** If you maintain a Rust system with an `unsafe` core, the methodology transfers. Everything is open: [vostd](https://github.com/asterinas/vostd).

----

Rust's `unsafe` mechanism is an escape hatch for low-level code. In kernel development, that hatch is unavoidable. Kernels must manage raw physical addresses, manipulate hardware page tables, and execute direct memory access, operations that cannot be expressed as safe Rust. Outside of those low-level operations, the kernel still benefits from the high-level guarantees that come for free with safe Rust—but only if they still hold in the presence of `unsafe`.

The standard way to bridge the gap is to carefully encapsulate the `unsafe` code into a safe abstraction, allowing its consumers to ignore the implementation details. But an abstraction is only as good as your confidence in it. How can you actually *trust* that the safe API built around your `unsafe` code is perfectly sound for every possible caller, in every possible state? Is it sufficient annotate every unsafe block with a '`SAFETY: ...`' comment explaining why it will not go wrong? No. Even when such comments are detailed and precise, they cannot possibly exhaustively cover the space of possible states that the library as a whole could reach.

**[Asterinas](https://github.com/asterinas/asterinas)** exemplifies the importance of sound encapsulation. Its **[framekernel architecture](https://asterinas.github.io/book/kernel/the-framekernel-architecture.html)** isolates the raw dangerous primitives—physical memory management, synchronization, hardware configuration, and so on—from the rest of the kernel, in the Operating System Standard Library ([OSTD](https://asterinas.github.io/book/ostd/index.html)). Kernel developers working on top of OSTD have access to the powerful abstractions and guarantees of safe Rust. But those guarantees can only be trusted if the OSTD interface is sound! A bug in OSTD isn't just a localized issue; it compromises the safety guarantees of the entire rest of the kernel.

When a small piece of code has an outsized impact on system reliability, it is the perfect candidate for **formal verification** (FV). FV uses a specialized [logic](https://en.wikipedia.org/wiki/Hoare_logic) to create machine-checked proofs that guarantee the code behaves exactly as intended. While writing these specifications and proofs requires significant upfront effort, the payoff is absolute certainty with zero runtime overhead. And as we will show, that *effort is now far more manageable than it used to be*.

A year ago, *our [Phase I](https://asterinas.github.io/2025/02/13/towards-practical-formal-verification-for-a-general-purpose-os-in-rust.html) groundwork* successfully verified isolated functions within the memory management (`mm`) module in OSTD. While meaningful, these proofs were localized.

**This post marks the completion of Phase II.** Not only have we verified *more* functions' individual behavior, but we have successfully proven that the public memory-management API is **sound**. Read on to discover what soundness means from a theoretical standpoint, and how we prove that it holds on this library.

## Verification Methodology

First, let's start with a simple explanation of how verification works. To summarize: formal verification involves annotating program code with a mathematical specification describing its effect on the overall program state. A complex program's overall behavior arises emergently from disparate pieces of data, often managed by many functions and subsystems. The specification distills that complexity down to a simpler, unified structure, and describes individual functions' behavior in terms of that structure. Then, for each function, a verification tool analyzes the concrete structure of the code and attempts to construct a logical proof that the specification holds on all inputs. Often a verification engineer must add annotations to assist this process.

Specifications naturally compose vertically, with the verification of one function depending on the verified behavior of other functions that it calls, defining how the state changes at each level of the call stack. This is termed *correctness*.

Proving soundness also requires horizontal composition in the form of an *invariant*: a property of system states that is guaranteed to always hold. Correctness proofs across the codebase prove that the invariant holds after each call, and therefore no caller can cause a state that would lead to UB.

## Verus

Our verification tool of choice is [Verus](https://github.com/verus-lang/verus), which integrates directly with the Rust language. Verus code is Rust code, with additional constructs that allow us to annotate functions with preconditions (boolean formulae that must be true in order to safely call the function) and postconditions (which we would like to prove to hold when the function returns). The Verus compiler converts the pre- and postconditions of each function into a logical representation and searches for a proof that all executions that satisfy the preconditions must, at each function exit, satisfy the postconditions.

For complex verification, Verus also allows us to add *ghost state* that exists only during the verification. Because ghost variables are not compiled into executable code, they have no performance impact. They are only used to instrument the code to make information about the broader system legible to the verifier. For example, Verus' pointer libraries provide a ghost [`PointsTo<T>`](https://verus-lang.github.io/verus/verusdoc/vstd/simple_pptr/struct.PointsTo.html) type which encodes the current state of a piece of raw memory containing an object of type `T`. A `PointsTo` can only be constructed and modified through [*valid pointer operations*](https://verus-lang.github.io/verus/verusdoc/vstd/simple_pptr/struct.PPtr.html#example), so its existence provides the "witness" for Verus that the current state of an object in memory is valid.

To see the difference this makes, compare a raw pointer write against its Verus counterpart. In ordinary Rust, dereferencing a `*mut` is `unsafe`: the programmer must promise that the pointer is valid. In Verus, the write instead consumes a `PointsTo` permission, so the memory access is only accepted when the programmer can produce that witness. The permission then updates with the new value to use for later proofs. In the example below, `Tracked` is a kind of ghost object that obeys the borrow checker, using Rust's existing infrastructure to ensure that the permission is unique.

<style>
.code-cols .highlight pre {
  width: max-content;
  min-width: 100%;
  box-sizing: border-box;
}
.code-cols .highlight code,
.code-cols .highlight span {
  font-size: 0.21rem;
}
/* Rouge's Rust lexer has no rules for `<`, `>` or `&` inside a
   `#[...]` attribute, so it emits Error tokens there. Neutralize the
   default red-on-pink `.err` styling for this post's code blocks. */
.highlight .err {
  color: inherit;
  background-color: transparent;
}
</style>

<div class="code-cols" style="display: flex; gap: 0.25rem; margin: 1rem 0; align-items: flex-start;">
<div style="flex: 1 1 0; min-width: 0; overflow-x: auto;" markdown="1">
**Raw Rust**

```rust
unsafe fn set(ptr: *mut u8, val: u8) {
    *ptr = val;
}
```
</div>
<div style="flex: 1 1 0; min-width: 0; overflow-x: auto;" markdown="1">
**Verus**

```rust
fn set(ptr: PPtr<u8>, val: u8,
       perm: Tracked<&mut PointsTo<u8>>)
    requires
        old(perm).pptr() == ptr,
        !old(perm).is_init(),
    ensures  final(perm).value() == val,
{
    ptr.put(perm, val);
}
```
</div>
</div>

We define our own ghost types that track parts of the system state that are invisible to any given function. For example, a page table is a tree of nodes and their entries, so a [`PageTableOwner`](https://asterinas.github.io/vostd/ostd/specs/mm/page_table/struct.PageTableOwner.html) is a tree of [`EntryOwner`](https://asterinas.github.io/vostd/ostd/specs/mm/page_table/node/entry_owners/struct.EntryOwner.html) and [`NodeOwner`](https://asterinas.github.io/vostd/ostd/specs/mm/page_table/node/owners/struct.NodeOwner.html) ghost objects, each describing the current state of a concrete object in the system without the need for executable code to access it.

Let's zoom in on the function [`Entry::replace`](https://github.com/asterinas/vostd/blob/f0094f8a5ca5793c3cb67ba1160f8db7aea179fb/ostd/src/mm/page_table/node/entry.rs#L365), which overwrites a page table entry. In non-verified code, the function makes three promises when it calls the unsafe [`write_pte`](https://asterinas.github.io/vostd/ostd/mm/page_table/struct.PageTableGuard.html#method.write_pte):

```rust
// SAFETY:
// 1. The index is within the bounds.
// 2. The new PTE is a valid child whose level matches the 
//    current page table node.
// 3. The ownership of the child is transferred to the page table node.
unsafe { self.node.write_pte(self.idx, self.pte) };
```

In Verus, these promises can be made explicit preconditions of `write_pte` as below, which takes an additional ghost argument of type `NodeOwner`.


```rust
#[verus_spec(with Tracked(owner): Tracked<&mut NodeOwner<C>>)]
fn write_pte(&mut self, idx: usize, pte: C::E)
    requires
      idx < NR_ENTRIES, // Promise 1
      old(self).inner.inner@.invariants(*old(owner)) // Subsumes 2
    ensures
      owner.inv(), // Used in caller to prove 3
      owner.children.value() == old(owner).children.value().update[idx, pte],
      ...
```

## Vertical Composition

Now all calls to `write_pte` from anywhere in the verified codebase will have these `requires` conditions checked at compile time. At the same time, `write_pte` has obligations of its own (`ensures`). It maintains a weakened invariant, and sets the value of memory at the designated index to match the parameter.

![write_pte() function specification](/assets/images/verifying-ostd-soundness/write_pte.png)

In addition, the postconditions of `write_pte` allow its caller `replace` to satisfy its own obligations, and on down the call chain. So, function-level specifications are *vertically composed* as a matter of Verus' fundamental design.

![Soundness and Correctness](/assets/images/verifying-ostd-soundness/soundness_correctness.png)

Properties of this kind, relating a function's inputs to its outputs in a vertical composition between callers and callees, are commonly called *correctness* properties. Soundness and correctness are deeply intertwined. Even if our goal is not necessarily to prove correctness for the entire system, proving *anything* about higher level functions depends on the correctness of lower level functions. In this case, `Entry::replace` is called by `CursorMut::replace_cur_entry`, which is called by [`CursorMut::map`](https://asterinas.github.io/vostd/ostd/mm/vm_space/struct.CursorMut.html#method.map). The soundness proof for `map` depends on this entire chain of logic. Because lower-level proofs are "consumed" by higher-level ones, we are motivated to make their specifications as precise as possible.

In short, we describe the overall system in terms of logical state, and specify how that state is allowed to change during execution. Then, Verus checks that our specifications hold through mathematical deduction. These individual function specifications, combined across the entire system, must support our ultimate claim of soundness.

What does that mean?

## Defining Soundness As Horizontal Composition

"Soundness" is a contract between a library and its caller. As long as the caller does not exhibit UB, the library will not either. The caller is otherwise allowed to do anything it wants! Even if the caller's behavior is nonsensical, the library needs to respond with a well-defined result. In this case, the caller is assumed to be written in safe Rust, so it will satisfy its end of the bargain by definition.

Let's call the caller $C$, and represent the caller linking with OSTD using the $\bowtie$ symbol, creating an OS kernel program $C \bowtie \mathit{OSTD}$. We can think of the result of executing that program once as a *trace* of interactions between the two components: a possibly infinite sequence of state transitions. We write $C \bowtie \mathit{OSTD} \rightsquigarrow t$ to mean that the trace $t$ can be produced by $C$ linked with OSTD.

Without getting into the details of how a trace is constructed, it consists of a potentially infinite sequence of events: calls from $C$ to OSTD, returns from OSTD back to $C$, panics, etc. A trace might encode:

- the program running forever - $\mathbf{infinite}(t)$,
- the program terminating or panicking - $\mathbf{terminates}(t)$,
- the program getting *stuck* - $\mathbf{stuck}(t)$ - which means that the Rust abstract machine has no defined way to continue. In other words, *UB*.

To sum up soundness in a single formula:

$$
\forall ~ C ~ t. ~ \textnormal{safe}(C) \wedge C \bowtie \mathit{OSTD} \rightsquigarrow t \Rightarrow \mathbf{well\_defined}(t)
$$

where

$$
\mathbf{well\_defined}(t) \triangleq \mathbf{infinite}(t) \lor \mathbf{terminates}(t)
$$

and

$$
\mathbf{well\_defined}(t) \Rightarrow \neg \mathbf{stuck}(t)
$$

Let's examine the implications of this formulation:

- We quantify over all possible callers, which is much harder than verifying a single program. The only obligation we impose on $C$ is $\mathbf{safe}(C)$: that the caller is well-typed under Rust's type system and contains no `unsafe` blocks.
- We quantify over all traces; **for the kernel developer**, this means that they can call any OSTD function in any order, with any arguments, and be assured of never reaching undefined behavior.
- UB is undecidable, but by definition, a Verus-verified function is well-defined. We aren't looking for individual cases of UB, we are constructively proving that there is some defined behavior for any $C$, which inherently rules out UB.

## Proof by Invariant

The first step to proving the theorem above is breaking down a trace into individual calls. The key is to define a set of invariants for each type defined in OSTD that can be proven to always hold true, and to use them as the sole preconditions for all API functions.

By induction, if the system starts in a valid state, and every possible API call preserves the invariants on objects that it interacts with, then the state is always valid between calls. This allows us to break the verification of a system-level property into a series of *correctness* proofs. The invariants are the glue that hold them together in a *horizontal composition*.

What kinds of facts are included in the invariant? Most invariants are tied to types. To list a few:
- every `Frame` object corresponds to a valid piece of metadata tracked in a special region ([`MetaRegionOwners`](https://asterinas.github.io/vostd/ostd/specs/mm/frame/meta_region_owners/struct.MetaRegionOwners.html))
- all shareable frames have a reference count between 0 and `REF_COUNT_MAX` ([`MetaSlotOwner`](https://asterinas.github.io/vostd/ostd/specs/mm/frame/meta_owners/struct.MetaSlotOwner.html#method.inv))
- each page table lives in a frame that is exclusively allocated for that purpose, while leaf entries may exist at multiple points in the tree ([`EntryOwner`](https://asterinas.github.io/vostd/ostd/specs/mm/page_table/node/entry_owners/struct.EntryOwner.html#method.metaregion_sound))

![Soundness as Horizontal Composition](/assets/images/verifying-ostd-soundness/horizontal.png)

...and many more. Collectively, these system invariants restrict the states that the system is allowed to enter. This is why verifying isolated functions is insufficient. Even if individual functions are completely correct in a vacuum, any unverified code touching the same data structures could silently violate these shared invariants, thus invalidating the entire system's proof. To guarantee true soundness, the module must be verified as a cohesive whole. We check the final soundness property by embedding the specifications of verified functions in a state machine, which may take arbitrary steps using the specification of any function in any order, and proving by induction that every execution of that state machine gives a defined result.

## Phase II Milestones

We began a year ago with a proof of concept, verifying selected properties of individual functions but leaving the bulk of the code unverified. After taking lessons from that phase and scaling up our efforts, in just over a year we have expanded to cover the entire virtual memory subsystem of the memory management (`mm`) module, from raw physical frame allocation at the bottom to virtual address space mapping at the top.

The diagram below shows the structure of the verified subset, with unverified `mm` modules to the left and the rest of OSTD to the right. Vertically it shows the composition from high to low, with the `frame` module forming the foundation, but also exposed to the API, and the `page_table` module consumed by still higher level modules for managing virtual address spaces. Compare to last year's proof-of-concept: where we had picked out a handful of functions from each module, now we can simply list the modules.  Recall that horizontal composition is vital for proving soundness: verifying an entire subsystem is much more valuable than disconnected functions.

![Verified Subset of OSTD](/assets/images/verifying-ostd-soundness/subset.png)

Meanwhile, a parallel project called [CortenMM](https://dl.acm.org/doi/10.1145/3731569.3764836) has verified the complex concurrent correctness of the page table's fine-grained locking, and has been published in SOSP '25. Extending concurrent verification to the rest of OSTD is a goal for phase III. Work is also proceeding on the verification of the `sync` module.

Unlike many verification projects, OSTD is a living codebase. We began our verification on OSTD v0.15 and are currently tracking v0.16.0, which was a relatively painless transition thanks to our modular invariant structure and our tooling (especially KVerus, described below). Upstream OSTD recently released v0.18.0, and we plan to update the verified version to track it.

It is worth emphasizing how quickly this work was accomplished. In the early years of formal verification as a field, even verifying very small programs could require a massive, multi-year engineering effort. The cost barrier to verification continues to shrink, and our work shows that it is lower than ever.

As a proxy for cost, historically, formal verification requires about 20 lines of mathematical proof for every 1 line of code (a 1:20 ratio). This immense cost has blocked widespread industrial adoption. **We reduced this ratio to roughly 1:5.** More directly: we verified the soundness of roughly **6,000 lines of complex code in two person-years.**

This efficiency comes chiefly from advances in tooling: Verus’ automated SMT solver handles routine mathematical obligations that other systems would need to solve manually. Advances in AI assist at a higher level in finding proof annotations to help guid the solver in proofs that previously would require tedious human guidance. To this end we built **[KVerus](https://github.com/asterinas/KVerus)**, an AI-assisted tool that automatically generates a growing fraction of our proofs. Crucially, AI assistance does not alter the trustworthiness of our results. Every single proof generated by KVerus is strictly checked and validated by Verus's mathematical solver. AI frees our engineers to focus on the big picture questions: specifications, system models, and proof strategy.

## Takeaways

We verified part of a kernel with this approach, but very little of it is kernel-specific. Any Rust project relying on a complex `unsafe` core faces similar challenges, and can be approached in a similar way:

- **Draw a schematic:** Abstract away implementation details and define ghost types that mimic the logical structure of your system. Define the relationship between the concrete and abstract. Keep it consistent and document it well. Especially if you have AI assistance, consistent patterns and a few examples will accelerate its performance.
- **Anchor the foundation:** Axiomatize mechanisms below the Rust level carefully in terms of how they interact with your abstract model. Use them to verify that low-level functions stay in sync with their specifications.
- **Don't let the roof leak:** Need a strong precondition to verify a function? Not at the API level! Make it an invariant of the relevant ghost type, and prove that every API function preserves it. Don't make assumptions about the caller; constrain the whole system. When every API function is verified to preserve each invariant, with no extraneous preconditions, soundness follows by induction.
- **Fill in the walls:** You can build up from the lowest level, or down from highest. Either way you will need to iterate. When verifying a caller, you will find that your callee needs a stronger postcondition, or a weaker precondition. When you expand an invariant, you will need to revisit the invariant preservation proofs. Specification changes ripple through the entire effort. Keep them incremental and they'll still be manageable.

When you're done, you'll have top-to-bottom proofs encircling your entire library, that no API call can ever put the system into a state from which its behavior is undefined. The developers using your API can forget that unsafe Rust even exists.
