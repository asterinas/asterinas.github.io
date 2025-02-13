---
layout: post
title:  "Towards Practical Formal Verification for a General-Purpose OS in Rust"
date:   2025-02-13 17:00:00 +0800
author: "CertiK and Hongliang Tian"
---

Historically, formal verification has largely focused on specialized, verification-friendly operating systems (OSes) such as [seL4](https://github.com/seL4/l4v), [CertiKOS](http://flint.cs.yale.edu/certikos/), [Verve](https://www.microsoft.com/en-us/research/publication/safe-to-the-last-instruction-automated-verification-of-a-type-safe-operating-system/), and [Atmosphere](https://dl.acm.org/doi/10.1145/3625275.3625401). These OSes are deliberately small and often lack many of the common features found in full-fledged, UNIX-style OSes.

With [Asterinas](https://github.com/asterinas/asterinas), we aim to change this status quo by taking the advantage on our [framekernel](https://asterinas.github.io/book/kernel/the-framekernel-architecture.html) architecture. Now that the Trusted Computing Base (TCB) has been made so small, verifying only a relatively small portion of Rust code (with `unsafe`) can guarantee the memory safety of the entire kernel.

Over the past year, we, the Asterinas community, has collaborated with [CertiK](https://www.certik.com/), an industry leader in formal verification for security-critical systems, to verify a critical component of Asterinas's TCB: the page management module (including page tables). This work is a key milestone in our pursuit of a formally verified TCB.

In this post, we share the initial results of this work-in-progress. Specifically, we will highlight how we have verified Asterinas's page tables with [Verus](https://github.com/verus-lang/verus). Additional technical details can be found in this [report](https://github.com/asterinas/slides/blob/f62c764ea9c4831a747dbe8fa415b56e48493482/slides/2025-01-28%20Asterinas%20Security%20Assessment%20by%20CertiK.pdf) by CertiK. Like the OS itself, the verification code is also [open source](https://github.com/asterinas/vostd).

## Overview of the Page and Paging Subsystem

The framekernel architecture of Asterinas entails a minimal TCB in terms of memory safety. For Asterinas, the TCB is the [OSTD](https://asterinas.github.io/book/ostd/index.html), a (unofficial) Rust standard library for OS development. OSTD offers a set of safe abstractions enabling the creation of feature-rich, UNIX-style OSes in safe Rust. However, although its API is safe, its implementation is `unsafe`, given the need for low-level interactions with hardware - such as managing physical memory pages and page tables.

The page and paging subsystem is organized into a hierarchy of abstractions. From high-level to low-level, these abstractions include:

```rust
/// The virtual memory space for a user process.
pub struct VmSpace {
    pt: PageTable<UserMode>,
    // more ...
}

impl VmSpace {
    /// Provides a cursor to access the specified address range.
    pub fn cursor(&self, va: &Range<Vaddr>) -> Result<Cursor<'_>> { ... }

    /// Provides a cursor to manipulate the specified address range.
    pub fn cursor_mut(&self, va: &Range<Vaddr>) -> Result<CursorMut<'_, '_>> { ... }
}

/// A generic page table for any target CPU architecture.
struct PageTable<
    M,                        // Page table mode: user or kernel
    E = arch::PageTableEntry, // CPU arch-specific page table entry
    C = arch::PagingConsts,   // CPU arch-specific paging constants
> {
    root: RawPageTableNode<E, C>,
    _phantom: PhantomData<M>,
}

/// The ownership of a page table node.
struct PageTableNode<
    E = arch::PageTableEntry, // CPU arch-specific page table entry
    C = arch::PagingConsts,   // CPU arch-specific paging constants
> {
    page: Page<PageTablePageMeta<E, C>>,
}

/// The ownership of a physical memory page.
struct Page<M /* The purpose of this page */> {
    // Each page is uniquely identified by a metadata slot,
    // which contains a reference count and a custom field of `M`.
    ptr: *const MetaSlot,
    _marker: PhantomData<M>,
}
```

Though simplified, these definitions reflect key design points:

1. **Separation of user and kernel virtual address spaces.** This separation is crucial for OSTD’s soundness. OSTD safely exposes full control of user virtual memory, but the kernel’s memory space remains private. A mistake in user-space page table manipulation by safe Rust will not compromise the memory safety of the kernel space.

2. **Fine-grained locking with cursors.** Page tables are manipulated with `Cursor` objects to reduce lock contention. Instead of locking the entire page table, a cursor locks only the page table node containing the current page table entry along with its ancestor nodes.

3. **Reference-count-based page management.** Physical pages are tracked through reference-counted `Page<M>` objects, ensuring that no physical page is used for conflicting purposes. Each `Page` is essentially a specialized `Arc`, supporting cheap cloning and reference counting, but without dynamic heap allocation.

Our ultimate goal is to formally verify the correctness and soundness of these abstractions. The diagram below summarizes our verification plan and progress:

![Verification Overview](/assets/images/2025-02-13-post-verification-overview.png)

Within these four layers of abstractions (in blue), we have identified 14 high-priority verification targets, of which 11 (in green) are verified and 3 (in yellow) remain. In total, we have produced roughly 6K lines of specification code and 2K lines of proof code for about 2K lines of executable code.

This formal verification effort vastly boosts our confidence in the kernel. For instance, we have proven that `Cursor`-based navigation of page tables is correct (Targets #10 and #11). We have also proven that `Page`, as a reference-counted smart pointer, is correct (Targets #1, #3, and #4). During this work, we discovered new bugs, including a race condition that might have allowed a page table node to be freed prematurely.

## Verification Methodology

We use [Verus](https://github.com/verus-lang/verus), an SMT-based verification tool for native Rust. Our workflow for verifying a new target follows four main steps: **(1) code import**, **(2) initial code proof**, **(3) specification**, and **(4) final code proof**.

### Code Import

We begin by importing the types and functions to be verified into Verus, along with any simpler dependencies not yet verified. Complex dependencies are replaced with stubs and functional specifications, which will be refined later.

### Initial Code Proof

Next, we run Verus on the code as-is, and it often flags potential buggy code or unsafe behaviors. For example, consider this function:

```rust
pub const fn align_down(x: usize, align: usize) -> usize {
   x & !(align - 1)
}
```

Verus may complain about possible overflow when `align` is zero, prompting a precondition:

```rust
pub const fn align_down(x: usize, align: usize) -> usize
   requires
       align > 0
{ /*...*/ }
```

Verus uses an SMT solver to detect such edge cases. The `requires` clause here ensures that no overflow occurs by prohibiting `align == 0`. These fixes yield strong safety guarantees right from the start.

### Specification

We then formalize what a function must do by writing a specification, often through a boolean expression relating the return value to its inputs or via a relational spec referencing an abstract model:

```rust
pub const fn align_down(x: usize, align: usize) -> (res: usize)
   requires
       align > 0
   ensures
       res <= x,
       res % align == 0
{ /* ... */ }
```

If Verus cannot automatically prove these properties, we add assertions, lemmas, or additional preconditions to guide it.

### Final Code Proof

Sometimes, complex loops or recursive functions require us to “sketch” a proof with placeholders that we fill in later. Once those placeholders are proven, we finalize the verification.

## Example: Verifying the `Cursor` API

The `Cursor` abstraction is an excellent example of *relational* proofs in Verus:

```rust
pub struct Cursor<'a, M: PageTableMode> {
    guards: [Option<PageTableNode>; 4],
    level: PagingLevel,
    guard_level: PagingLevel,
    va: Vaddr,
    barrier_va: Range<Vaddr>,
}
```

The `Cursor` stores the current virtual address (`va`), the corresponding level in the page table hierarchy (`level`), and an array of locks (`guards`). However, to reason about correctness, we need an abstract model describing what the cursor “really” represents. For that, we introduce the `ConcreteCursor`:

```rust
pub tracked struct ConcreteCursor {
    pub tracked tree: PageTableTreeModel,
    pub tracked locked_subtree: PageTableNodeModel,
    pub tracked path: PageTableTreePathModel,
}
```

(`tracked` objects are used for verification but dropped at compilation time.)

The `ConcreteCursor` carries:
- `tree`: A model of the entire page table.
- `locked_subtree`: The node (and subtree) currently locked.
- `path`: A sequence of indices from the root to the current node.

We connect `Cursor` to `ConcreteCursor` with `Cursor::relate()`, which checks, for instance, that `self.va` and `self.level` match `model.path.vaddr()` and the path length in `model`.

```rust
   pub open spec fn relate(self, model: ConcreteCursor) -> bool
       recommends
           model.inv(),
   {
   &&& self.level == NR_LEVELS() - model.path.len()
   &&& self.va == model.path.vaddr()
   &&& self.relate_locked_region(model)
   }
```

(In Verus, `&&&` is the “bulleted list” form of logical and, `&&`.)

Suppose that we want to specify the `Cursor::pop_level()` function, which moves the cursor one level up. To do so, we define a specification that removes the last index from the `path`:

```rust
pub open spec fn pop_level_spec(self) -> ConcreteCursor {
    let (tail, popped) = self.path.inner.pop_tail();
    ConcreteCursor {
        path: PageTableTreePathModel {
            inner: popped
        },
        ..self
    }
}
```

And we prove the implementation matches this spec:

```rust
fn pop_level(&mut self, Tracked(model): Tracked<&ConcreteCursor>)
    requires
        old(self).inv(),
        model.inv(),
        old(self).relate(*model),
        // ...
    ensures
        self.inv(),
        self.relate(model.pop_level_spec()),
{
    // ...
}
```

If the old cursor relates to `model`, then after calling `pop_level()`, the new cursor must relate to `model.pop_level_spec()`. You can find the full code and proof for this and other cursor functions [here](https://github.com/asterinas/vostd/blob/cd00ac386e3e961691f3b776bf749b3c8bea02e5/fvt10-pt-cursor-navigation/src/page_table/cursor/mod.rs).

## Refinement Invariants

This style of proof underpins the functional correctness of many of our verification targets and will form the basis of a broader refinement proof, ensuring consistency across different levels of the page table.

- **`PageTableTreeModel`** describes the structure of the page table for low-level memory management.
- **`PageTableFlatModel`** offers a high-level view: a mapping from virtual addresses to physical pages.

We prove that the concrete model ("tree") refines the flat model by maintaining invariants after each update. These invariants ensure that traversing the page table is always sound. Even when the underlying code uses `unsafe`, the proven invariants guarantee its safety.

## Future Plans

Our ongoing work to build a formally verified, general-purpose OS raises several open questions:

- **Concurrency.** A key challenge is simplifying the verification of concurrent Rust code, particularly when multiple threads or CPU cores manipulate shared data structures like page tables. The recent progress on [VerusSync](https://www.cs.utexas.edu/~hleblanc/pdfs/verus.pdf) — a permission-based (token-based) toolkit for concurrency verification — offers promising solutions. By enforcing permissions for specific virtual address ranges when multiple threads operate on `VmSpace` through `Cursor`s, concurrency proofs can become nearly as straightforward as their sequential counterparts.

- **Evolution.** Keeping verification artifacts in sync with an evolving codebase remains a persistent concern. At present, we lack the tool to seamlessly link Verus-verified binaries with the rest of the kernel, which can lead to potential discrepancies. Additionally, Verus still lacks support for certain Rust features, such as [manually-managed trait objects](https://doc.rust-lang.org/std/ptr/struct.DynMetadata.html) — recently introduced in Asterinas for the automatic page type system. Striking the right balance between verifiability and ease of kernel development is an ongoing question.

- **Community.** Finally, we aim to grow a broader community of systems developers willing to engage in formal verification. Much work remains to make our infrastructure more accessible to contributors unfamiliar with verification techniques. Improving documentation, tooling, and training resources will be essential for lowering the barrier to entry and encouraging more developers to join our efforts.

With the combined strengths of Rust, Verus, and framekernels, we believe it is possible to create large-scale, general-purpose OSes with unprecedented assurance. If you're interested in contributing or learning more, check out our GitHub repositories ([OS code](https://github.com/asterinas/asterinas) and [verification code](https://github.com/asterinas/vostd)) and join the community discussions!
