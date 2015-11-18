package controllers

import play.api._
import play.api.mvc._

import libs.json._

object Application extends Controller {

  def index = Action {
    Ok(views.html.index())
  }

  def editor = Action {
    Ok(views.html.editor())
  }

  def docs = Action {
    Ok(views.html.docs())
  }

}
