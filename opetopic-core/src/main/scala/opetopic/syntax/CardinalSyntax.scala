/**
  * CardinalSyntax.scala - Syntax and Operations for Cardinals
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic.syntax

import scala.language.higherKinds
import scala.language.implicitConversions

import scalaz.Traverse
import scalaz.Applicative

import opetopic._
import TypeLemmas._

final class CardinalOps[A[_ <: Nat], N <: Nat](cardinal : Cardinal[A, N]) {

  type INst[K <: Nat] = CardinalNesting[A[K], K]

  def dim : N = 
    cardinal.length.pred

  def head : CardinalNesting[A[N], N] = 
    Suite.head[INst, N](cardinal)

  def toComplexWith[B[K <: Nat] >: A[K], C[K <: Nat] <: B[K]](p: PolaritySuite[C, N]) : Complex[B, N] = 
    Cardinal.completeToComplex(dim)(cardinal, p)
  
  def extrudeSelection[K <: Nat](k: K)(ca: CardinalAddress[K], a0: A[K], a1: A[S[K]])(pred: A[K] => Boolean)(implicit diff : Diff[S[K], N]) = 
    Cardinal.extrudeSelection[A, K, N, diff.D](diff.lte)(cardinal, ca, a0, a1)(pred)

}

trait ToCardinalOps {

  implicit def cardinalTreeIsTraverse[N <: Nat](implicit n: N) : scalaz.Traverse[({ type L[+A] = CardinalTree[A, N] })#L] = 
    new Traverse[({ type L[+A] = CardinalTree[A, N] })#L] {

      def traverseImpl[G[_], A, B](ct: CardinalTree[A, N])(f: A => G[B])(implicit isA: Applicative[G]) : G[CardinalTree[B, N]] = 
        Cardinal.traverseCardinalTree(n)(ct)(f)

    }

  import scalaz.syntax.FunctorOps
  import scalaz.syntax.TraverseOps
  import scalaz.syntax.traverse._

  implicit def cardinalTreeToTraverseOps[A, N <: Nat](ct: CardinalTree[A, N])(implicit n: N) : TraverseOps[({ type L[+X] = CardinalTree[X, N] })#L, A] = 
    ToTraverseOps[({ type L[+X] = CardinalTree[X, N] })#L, A](ct)

  implicit def cardinalTreeToFunctorOps[A, N <: Nat](ct: CardinalTree[A, N])(implicit n: N) : FunctorOps[({ type L[+X] = CardinalTree[X, N] })#L, A] = 
    ToFunctorOps[({ type L[+X] = CardinalTree[X, N] })#L, A](ct)

  implicit def toCardinalOps[A[_ <: Nat], N <: Nat](cardinal : Cardinal[A, N]) : CardinalOps[A, N] = 
    new CardinalOps(cardinal)

  implicit def toFiniteCardinal[A[_ <: Nat], N <: Nat](cardinal: Cardinal[A, N]) : FiniteCardinal[A] = 
    Sigma[({ type L[K <: Nat] = Cardinal[A, K] })#L, N](cardinal.length.pred)(cardinal)

  implicit def cardinalToSuiteOps[A[_ <: Nat], N <: Nat](cardinal: Cardinal[A, N]) : SuiteOps[Lambda[`K <: Nat` => CardinalNesting[A[K], K]], S[N]] = 
    new SuiteOps[Lambda[`K <: Nat` => CardinalNesting[A[K], K]], S[N]](cardinal)

}
