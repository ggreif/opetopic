/**
  * package.scala - MTL package definitions
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic

package object mtl {

  type Id[A] = A

  implicit val idIsTraverse: Traverse[Id] =
    new Traverse[Id] {
      def traverse[G[_], A, B](a: A)(f: A => G[B])(implicit isAp: Applicative[G]) : G[B] = f(a)
    }

  implicit val idIsMonad: Monad[Id] = 
    new Monad[Id] {
      def pure[A](a: A): A = a
      def flatMap[A, B](a: A)(f: A => B) : B = f(a)
    }

  implicit val optionIsTraverse: Traverse[Option] = 
    new Traverse[Option] {
      def traverse[G[_], A, B](opt: Option[A])(f: A => G[B])(implicit isAp: Applicative[G]) : G[Option[B]] = 
        opt match {
          case None => isAp.pure(None)
          case Some(a) => isAp.ap(f(a))(isAp.pure(Some(_)))
        }
    }

  implicit val optionIsMonad: Monad[Option] = 
    new Monad[Option] {
      def pure[A](a: A): Option[A] = Some(a)
      def flatMap[A, B](opt: Option[A])(f: A => Option[B]): Option[B] =
        opt.flatMap(f)
    }

  implicit val listIsTraverse: Traverse[List] = 
    new Traverse[List] {
      def traverse[G[_], A, B](lst: List[A])(f: A => G[B])(implicit isAp: Applicative[G]) : G[List[B]] = 
        lst match {
          case Nil => isAp.pure(Nil)
          case a :: as => isAp.ap2(f(a), traverse(as)(f))(isAp.pure(_ :: _))
        }
    }

  implicit def toTraverseOps[F[_], A](fa: F[A])(implicit t: Traverse[F]): TraverseOps[F, A] = 
    new TraverseOps[F, A](fa) { val T = t }

  implicit def toMonadOps[F[_], A](fa: F[A])(implicit m: Monad[F]): MonadOps[F, A] = 
    new MonadOps[F, A](fa) { val M = m }

}
