/**
  * SComplex.scala - Stable Complexes
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic

import mtl._

trait ComplexTypes {

  sealed trait FaceAddr
  case class ThisDim(addr: SAddr) extends FaceAddr
  case class PrevDim(faddr: FaceAddr) extends FaceAddr

  object FaceAddr {

    def apply(i: Int, addr: SAddr): FaceAddr =
      if (i <= 0) ThisDim(addr) else PrevDim(FaceAddr(i-1, addr))

    implicit class FaceAddrOps(fa: FaceAddr) {

      def codim: Int =
        fa match {
          case ThisDim(_) => 0
          case PrevDim(p) => p.codim + 1
        }

      def address: SAddr =
        fa match {
          case ThisDim(a) => a
          case PrevDim(p) => p.address
        }

    }

  }

  type SComplex[+A] = Suite[SNesting[A]]
  type SCmplxZipper[+A] = Suite[SNstZipper[A]]

  object SCmplxZipper {
    def apply[A](c: SComplex[A]): SCmplxZipper[A] = 
      Traverse[Suite].map(c)(SNstZipper(_))
  }

  implicit object ComplexTraverse extends Traverse[SComplex] {

    def traverse[G[_], A, B](c: SComplex[A])(f: A => G[B])(implicit isAp: Applicative[G]) : G[SComplex[B]] =
      Traverse[Suite].traverse(c)(_.traverse(f))
    
  }

  implicit class SComplexOps[A](c: SComplex[A]) {

    def dim: Int = c.length - 1
    def topCell: A = c.head.baseValue

    //
    //  Traversals and maps
    //

    def traverseWithAddr[G[_], B](f: (A, FaceAddr) => G[B], codim: Int = 0)(implicit isAp: Applicative[G]): G[SComplex[B]] = {

      import isAp._

      c match {
        case ||(nst) => ap(nst.traverseWithAddr((a, addr) => f(a, FaceAddr(codim, addr))))(pure(||(_)))
        case tl >> hd => {

          val newTl : G[SComplex[B]] = tl.traverseWithAddr(f, codim + 1)
          val newHd : G[SNesting[B]] = hd.traverseWithAddr((a, addr) => f(a, FaceAddr(codim, addr)))

          ap2(newTl, newHd)(pure(_ >> _))

        }
      }
    }

    def mapWithAddr[B](f: (A, FaceAddr) => B, codim: Int = 0): SComplex[B] =
      c match {
        case ||(hd) => hd.mapWithAddr((a, addr) => f(a, FaceAddr(codim, addr)))
        case tl >> hd => tl.mapWithAddr(f, codim + 1) >>
          hd.mapWithAddr((a, addr) => f(a, FaceAddr(codim, addr)))
      }

    //
    //  Source Calculation
    //

    def elementAt(fa: FaceAddr): Option[A] =
      fa match {
        case ThisDim(addr) => c.head.elementAt(addr)
        case PrevDim(pa) => c.tail.flatMap(_.elementAt(pa))
      }

    def sourceAt(addr: SAddr): Option[SComplex[A]] =
      for {
        z <- SCmplxZipper(c).seek(addr)
        f <- z.focusFace
      } yield f

    def face(fa: FaceAddr): Option[SComplex[A]] =
      fa match {
        case ThisDim(addr) => c.sourceAt(addr)
        case PrevDim(pa) => c.tail.flatMap(_.face(pa))
      }

    // Get a face in a given dimension
    def face(d: Int)(addr: SAddr): Option[SComplex[A]] =
      c.face(FaceAddr(dim - d, addr))

    def comultiply: Option[SComplex[SComplex[A]]] =
      c.traverseWithAddr((_, fa) => c.face(fa))

    def addrComplex: SComplex[FaceAddr] =
      c.mapWithAddr((_, fa) => fa)

    def target: Option[SComplex[A]] =
      c match {
        case ||(_) => None
        case tl >> _ => tl.sourceAt(Nil)
      }

    def glob(tgt: A, fill: A): Option[SComplex[A]] = 
      c match {
        case ||(n) => Some(||(SBox(tgt, STree.obj(n))) >> SDot(fill))
        case tl >> hd => 
          tl.head match {
            case SBox(_, cn) => Some(
              tl >> SBox(tgt, SNode(hd, cn.asShell)) >> SDot(fill)
            )
            case _ => None
          }
      }

    def foreach(op: A => Unit): Unit = 
      new Suite.SuiteOps(c).foreach((n: SNesting[A]) => n.foreach(op))

    def foreachWithAddr(op: (A, SAddr) => Unit): Unit = 
      new Suite.SuiteOps(c).foreach((n: SNesting[A]) => 
        n.foreachWithAddr(op)
      )

    //
    //  Extracting frames from complexes
    //

    def asFrame: Option[(STree[A], A)] = {
      for {
        (a, cn) <- c.head.boxOption
        srcTr <- cn.traverse(n => n.dotOption)
      } yield (srcTr, a)
    }

    def cellFrame: Option[(STree[A], A)] = 
      for {
        tl <- c.tail
        frm <- tl.asFrame
      } yield frm

    // Colorings

    def isColoredBy(cc: SComplex[FaceAddr]): Option[Boolean] =
      validColoring(c, cc)

  }


  implicit class SCmplxZipperOps[A](z: SCmplxZipper[A]) {

    //
    //  Focus information
    //

    def focus: SNesting[A] = 
      z.head.focus

    def withFocus(n: SNesting[A]): SCmplxZipper[A] = 
      z match {
        case ||(hd) => ||(hd.withFocus(n))
        case tl >> hd => tl >> hd.withFocus(n)
      }

    // This does a bunch of extra work calculating
    // spines for derivatives which don't get used.
    // You should use laziness here to avoid all the
    // extra work.
    def focusDeriv[B]: Option[SDeriv[B]] =
      z match {
        case ||(_) => Some(SDeriv(SLeaf))
        case tl >> hd =>
          hd.focus match {
            case SDot(_) => 
              for {
                tc <- tl.focusCanopy
              } yield SDeriv(tc.asShell)
            case SBox(_, cn) => 
              for {
                sp <- cn.spine
                d <- tl.focusDeriv[SNesting[A]]
                dsh <- tl.focus.canopyWithGuide(sp, d)
              } yield SDeriv(dsh.asShell)
          }
      }

    def focusCanopy: Option[STree[SNesting[A]]] = 
      z.focus match {
        case SDot(_) => None
        case SBox(_, cn) => Some(cn)
      }

    // The spine starting from the current focus
    def focusSpine: Option[STree[A]] =
      focus match {
        case SDot(a) => focusDeriv[A].map(_.plug(a))
        case SBox(a, cn) => cn.spine
      }

    def focusFace: Option[SComplex[A]] = 
      z match {
        case ||(hd) => Some(||(SDot(hd.focus.baseValue)))
        case tl >> hd => 
          for {
            sp <- focusSpine
            d <- focusDeriv[STree[A]]
            c <- tl.extract(sp)
            dd <- SCmplxZipper(c).focusDeriv[SNesting[A]]
            chd <- c.head.compressWith(d.plug(sp), dd)
          } yield c.withHead(chd) >> SDot(hd.focus.baseValue)
      }

    //
    //  Basic Zipper Ops
    // 

    def close: SComplex[A] = 
      Traverse[Suite].map(z)(_.close)

    def visit(dir: SDir): Option[SCmplxZipper[A]] = 
      (z, dir) match {
        case (||(hd), d) => 
          for {
            zp <- hd.visit(dir)
          } yield ||(zp)
        case (tl >> hd, SDir(Nil)) => 
          for {
            zp <- hd.visit(dir)
          } yield tl >> zp
        case (tl >> hd, SDir(d :: ds)) => 
          for {
            zp <- z.visit(SDir(ds))
            hz <- zp.head.sibling(d)
            sp <- zp.focusSpine
            res <- sp match {
              case SLeaf => zp.tail.map(_ >> hz)
              case SNode(a, sh) => 
                for {
                  extents <- sh.extents
                  addr <- extents.elementAt(d.dir)
                  ntl <- zp.tail
                  ztl <- ntl.seek(addr)
                } yield ztl >> hz
            }
          } yield res
      }

    def seek(addr: SAddr): Option[SCmplxZipper[A]] = 
      addr match {
        case Nil => Some(z)
        case d :: ds =>
          for {
            zp <- z.seek(ds)
            zzp <- zp.visit(d)
          } yield zzp
      }

    //
    //  Source Extraction
    //

    def extract[B](guide: STree[B]): Option[SComplex[A]] = 
      z match {
        case ||(hd) => 
          for {
            pr <- hd.focus.exciseWith(guide, SDeriv(SLeaf))
          } yield ||(pr._1)
        case tl >> hd => 
          for {
            d <- focusDeriv[SNesting[A]]
            pr <- hd.focus.exciseWith(guide, d)
            (excised, boxTr) = pr
            (localSpine, compressor) = boxTr.treeSplit({
              case SDot(a) => ??? // An error ...
              case SBox(a, cn) => (a, cn)
            })
            sp <- compressor.join
            c <- tl.extract(sp)
            dd <- SCmplxZipper(c).focusDeriv[SNesting[A]]
            chd <- c.head.compressWith(compressor, dd)
          } yield c.withHead(chd) >> excised
      }

  }

  //============================================================================================
  // COMPLEX GRAFTING
  //

  // Uh, yeah, I haven't really tested these routines out yet.  I just translated from the
  // unstable version so they would be here for use in the type checker.  But you should
  // do some kind of test to make sure they're working as you would expect ...
  def graft[A](pd: STree[SComplex[A]])(disc: (A, A) => Option[A]): Option[(SComplex[A], STree[SNesting[A]])] = 
    for {
      pr <- pd.traverse({ 
        case ||(_) => None
        case tl >> hd => Some(tl, hd)
      })
      (cmplxTr, pdTr) = STree.unzip(pr)
      cmplxNst <- cmplxTr.toNesting({
        case Nil => None // Should have been a leaf? (I don't know what this means ...)
        case d :: ds => 
          for {
            zp <- cmplxTr.seekTo(ds)
            c <- zp.focus.rootValue
            cnst <- c.sourceAt(d :: Nil)
          } yield cnst
      })
      gres <- graftNesting(cmplxNst)(disc)
    } yield (gres, pdTr)


  // Uggh.  I hate this name, but I can't think of anything which is much better ...
  def graftNesting[A](nst: SNesting[SComplex[A]])(disc: (A, A) => Option[A]): Option[SComplex[A]] = 
    nst match {
      case SDot(c) => Some(c)
      case SBox(||(SBox(tgt, SNode(SDot(src), _))), SNode(pd, _)) => {

        // This should mean we are grafting a bunch of arrows, I think.

        for {
          grft <- graftNesting(pd)(disc)
          objNesting = grft.head
          v <- disc(src, objNesting.baseValue)
        } yield ||(SBox(tgt, STree.obj(objNesting.withBase(v))))

      }
      case SBox(c >> SBox(tgt, tcn), cn) => {

        // Blech.  A bit rough, no?

        for {
          cmplxSh <- cn.traverse(graftNesting(_)(disc))
          prTr <- tcn.matchTraverse(cmplxSh)({
            case (SDot(src), c0 >> nst) => {
              for {
                v <- disc(src, nst.baseValue)
              } yield (nst.withBase(v), c0.head)
            }
            case _ => None // Malformed result
          })
          (newCnpy, fillerTr) = STree.unzip(prTr)
          nstNst <- fillerTr.toNesting((addr: SAddr) => {
            for { zp <- c.head.seek(addr) } yield zp.focus
          })
          cdim2 <- SNesting.join(nstNst)
        } yield c.withHead(cdim2) >> SBox(tgt, newCnpy)

      }
      case _ => None // Malformed grafting problem ...
    }


  //============================================================================================
  // PICKLING
  //

  import upickle.Js
  import upickle.default._

  def complexToJson[A](c: SComplex[A])(implicit w: Writer[A]): String =
    upickle.json.write(Suite.suiteWriter(SNesting.nestingWriter(w)).write(c))

  def complexFromJson[A](c: Js.Value)(implicit r: Reader[A]): SComplex[A] = 
    Suite.suiteReader(SNesting.nestingReader(r)).read(c)

  //============================================================================================
  // COLOR CHECKING
  //

  def validColoring[A](c: SComplex[A], cc: SComplex[FaceAddr]): Option[Boolean] = {

    val coloringDim = c.dim
    val coloredDim = cc.dim

    if (coloringDim < coloredDim) {

      // In this case, the top cell must be colored by the
      // identity of the coloring complex, which is detected
      // by the following match:
      cc match {
        case frm >> SDot(ThisDim(Nil)) =>
          for {
            frmData <- frm.asFrame
            (srcs, tgtColor) = frmData
          } yield {

            // We kill the computation immediately on failure.  This avoids
            // having to repass through the resulting nesting of booleans in
            // the case where one of the sources failed.
            val srcCheck =
              srcs.traverseWithAddr((srcColor, addr) => {
                for {
                  coloringFace <- c.face(srcColor)
                  coloredFace <- cc.face(coloredDim - 1)(addr)
                  valid <- validColoring(coloringFace, coloredFace)
                  _ <- if (valid) Some(true) else None  
                } yield true
              })

            val tgtCheck =
              for {
                coloringTgt <- c.face(tgtColor)
                coloredTgt <- cc.target
                valid <- validColoring(coloringTgt, coloredTgt)
                _ <- if (valid) Some(true) else None
              } yield true

            // Return true if both computations above succeed
            srcCheck != None && tgtCheck != None

          }
        case _ => Some(false)
      }

    } else if (coloringDim == coloredDim) {

      // In this case, the top cell should be the identity and the face
      // should be colored by the codomain.  We check this directly with
      // the following match:
      cc match {
        case _ >> SBox(PrevDim(ThisDim(Nil)), srcs) >> SDot(ThisDim(Nil)) => {

          // Okay, this time, check that all sources are well colored as before,
          // but in addition check that they are *not* colored by the target of
          // the coloring opetope.

          val srcCheck =
            srcs.traverseWithAddr((srcDot, addr) => {
              srcDot match {
                case SDot(PrevDim(ThisDim(Nil))) => None
                case SDot(srcColor) => 
                  for {
                    coloringFace <- c.face(srcColor)
                    coloredFace <- cc.face(coloredDim - 1)(addr)
                    valid <- validColoring(coloringFace, coloredFace)
                    _ <- if (valid) Some(true) else None
                  } yield true
                case _ => None
              }
            })

          val tgtCheck =
            for {
              coloringTgt <- c.target
              coloredTgt <- cc.target
              valid <- validColoring(coloringTgt, coloredTgt)
              _ <- if (valid) Some(true) else None
            } yield true

            // Return true if both computations above succeed
            Some(srcCheck != None && tgtCheck != None)

        }
        case _ => Some(false)
      }

    } else {

      // In this case, our job is to "recolor" the colored complex with the
      // colors which would correspond to these when the head face is extracted.

      for {
        headColor <- cc.head.dotOption
        coloringFace <- c.addrComplex.face(headColor)
        addrMap = Map(coloringFace.mapWithAddr((g, l) => (g, Right(l))).toList : _*)
        cmplxMap = c.mapWithAddr((_, addr) => addrMap getOrElse (addr, Left(0)))
        recolored <- cc.traverse(fa => {
          for {
            entry <- cmplxMap.elementAt(fa)
            newColor <- entry match {
              case Right(l) => Some(l)
              case Left(_) => None
            }
          } yield newColor
        })
        valid <- validColoring(coloringFace, recolored)
      } yield valid

    }

  }

}
