/**
  * Syntax.scala - Syntax for Opetopic Type Theory
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic.tt

import opetopic._

// Expressions
sealed trait Expr
case object EType extends Expr
case object EUnit extends Expr
case object ETt extends Expr
case object EEmpty extends Expr

// Basic type theory
case class ELam(p: Patt, e: Expr) extends Expr
case class EPi(p: Patt, e: Expr, t: Expr) extends Expr
case class ESig(p: Patt, e: Expr, t: Expr) extends Expr
case class EPair(e: Expr, f: Expr) extends Expr
case class EFst(e: Expr) extends Expr
case class ESnd(e: Expr) extends Expr
case class EApp(e: Expr, f: Expr) extends Expr
case class EVar(id: Ident) extends Expr
case class EDec(d: Decl, e: Expr) extends Expr

// Categories and Cells
case object ECat extends Expr
case class EObj(c: Expr) extends Expr
case class ECell(c: Expr, frm: SComplex[Expr]) extends Expr

// Properties
case class EIsLeftExt(e: Expr) extends Expr
case class EIsRightExt(e: Expr, a: SAddr) extends Expr 

// Cell Constructors
case class ERefl(e: Expr) extends Expr
case class EDrop(e: Expr) extends Expr
case class EComp(pd: STree[Expr]) extends Expr
case class EFill(pd: STree[Expr]) extends Expr
case class ELiftLeft(e: Expr, ev: Expr, c: Expr, t: Expr) extends Expr
case class EFillLeft(e: Expr, ev: Expr, c: Expr, t: Expr) extends Expr
case class ELiftRight(e: Expr, ev: Expr, c: Expr, t: Expr) extends Expr
case class EFillRight(e: Expr, ev: Expr, c: Expr, t: Expr) extends Expr

// Property constructors
case class EDropIsLeft(c: Expr, e: Expr) extends Expr
case class EFillIsLeft(c: Expr, pd: Expr) extends Expr
case class EShellIsLeft(e: Expr, ev: Expr, s: Expr, t: Expr) extends Expr
case class EFillLeftIsLeft(e: Expr, ev: Expr, c: Expr, t: Expr) extends Expr
case class EFillRightIsLeft(e: Expr, ev: Expr, c: Expr, t: Expr) extends Expr
case class EFillLeftIsRight(e: Expr, ev: Expr, c: Expr, t: Expr) extends Expr
case class EFillRightIsRight(e: Expr, ev: Expr, c: Expr, t: Expr) extends Expr

// Values
sealed trait Val
case object Type extends Val
case object Unt extends Val
case object Tt extends Val
case object Empty extends Val

// Basic type theory values
case class Lam(c: Clos) extends Val
case class Pair(v: Val, w: Val) extends Val
case class Pi(v: Val, c: Clos) extends Val
case class Sig(v: Val, c: Clos) extends Val
case class Nt(n: Neut) extends Val

// Category and Cell Values
case object Cat extends Val
case class Obj(cv: Val) extends Val
case class Cell(c: Val, frm: SComplex[Val]) extends Val

// Property Values
case class IsLeftExt(v: Val) extends Val
case class IsRightExt(v: Val, a: SAddr) extends Val

// Cell Constructor values
case class Refl(v: Val) extends Val
case class Drop(v: Val) extends Val
case class Comp(pd: STree[Val]) extends Val
case class Fill(pd: STree[Val]) extends Val
case class LiftLeft(e: Val, ev: Val, c: Val, t: Val) extends Val
case class FillLeft(e: Val, ev: Val, c: Val, t: Val) extends Val
case class LiftRight(e: Val, ev: Val, c: Val, t: Val) extends Val
case class FillRight(e: Val, ev: Val, c: Val, t: Val) extends Val

// Property Constructor Values
case class DropIsLeft(c: Val, e: Val) extends Val
case class FillIsLeft(c: Val, pd: Val) extends Val
case class ShellIsLeft(e: Val, ev: Val, s: Val, t: Val) extends Val
case class FillLeftIsLeft(e: Val, ev: Val, c: Val, t: Val) extends Val
case class FillRightIsLeft(e: Val, ev: Val, c: Val, t: Val) extends Val
case class FillLeftIsRight(e: Val, ev: Val, c: Val, t: Val) extends Val
case class FillRightIsRight(e: Val, ev: Val, c: Val, t: Val) extends Val

// Neutral terms
sealed trait Neut
case class Gen(i: Int, n: Name) extends Neut
case class App(n: Neut, nf: Nf) extends Neut
case class Fst(n: Neut) extends Neut
case class Snd(n: Neut) extends Neut

// Patterns
sealed trait Patt
case object Punit extends Patt
case class PVar(id: Ident) extends Patt
case class PPair(p: Patt, q: Patt) extends Patt

// Declarations
sealed trait Decl
case class Def(p: Patt, e: Expr, f: Expr) extends Decl
case class Drec(p: Patt, e: Expr, f: Expr) extends Decl

// Function closures
sealed trait Clos
case class Cl(p: Patt, e: Expr, rho: Rho) extends Clos

// Environment
sealed trait Rho
case object RNil extends Rho
case class UpVar(rho: Rho, p: Patt, v: Val) extends Rho
case class UpDec(rho: Rho, d: Decl) extends Rho

