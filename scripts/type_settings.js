// Some fixtures that are currently not handled or provided by dd_cms
define(function(require) {

  var typeSettings = function() {
    var _ = require('underscore');
    var type_settings = {
      "GameRoot": {
        "type_data": {
          "id": "Game",
          "x":0,
          "y":0,
          "width":960,
          "height":600,
          "status_icons": {
            profiles: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 331, y: 616, width: 38, height: 38, pivotx: 18, pivoty: 7}
                },
                frame: 'normal'
              }
            },
            cash: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 369, y: 616, width: 45, height: 34, pivotx: 14, pivoty: 5},
                  button_deco: {x: 145, y: 616, width: 56, height: 43, pivotx: 26, pivoty: 10}
                },
                frame: 'normal'
              }
            },
            time: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 0, y: 616, width: 48, height: 48, pivotx: 22, pivoty: 22},
                  button_deco: {x: 0, y: 616, width: 48, height: 48, pivotx: -76, pivoty: 13}
                },
                frame: 'normal'
              }
            },
            AP: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 292, y: 655, width: 33, height: 38, pivotx: 12, pivoty: 7}
                },
                frame: 'normal'
              }
            },
            karma: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  up: {x: 374, y: 689, width: 34, height: 34, pivotx: 16, pivoty: 4},
                  normal: {x: 374, y: 655, width: 34, height: 34, pivotx: 16, pivoty: 4}
                },
                frame: 'normal'
              }
            },
            karmaUp: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 374, y: 655, width: 34, height: 34, pivotx: 16, pivoty: 4}
                },
                frame: 'normal'
              }
            },
            karmaDown: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 374, y: 689, width: 34, height: 34, pivotx: 16, pivoty: 4},
                },
                frame: 'normal'
              }
            },
            XP: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 325, y: 655, width: 47, height: 46, pivotx: -116, pivoty: 10}
                },
                frame: 'normal'
              }
            },

          },
          "slot_background": {
            "frameMap": {
              "free": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 516,
                "y": 0
              },
              "locked": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 716,
                "y": 0
              },
              "hover": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 616,
                "y": 0
              },
              "normal": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 416,
                "y": 0
              }
            },
            "frameSrc": "MainSprites.png"
          },
          "status_bar": {
            profiles: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 331, y: 616, width: 38, height: 38, pivotx: 18, pivoty: 7}
                },
                frame: 'normal',
                className: 'StatusIcon'
              }
            },
            cash: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 369, y: 616, width: 45, height: 34, pivotx: 14, pivoty: 5}
                },
                frame: 'normal',
                className: 'StatusIcon'
              }
            },
            AP: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 292, y: 655, width: 32, height: 38, pivotx: 12, pivoty: 7}
                },
                frame: 'normal',
                className: 'StatusIcon'
              }
            },
            karma: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  up: {x: 374, y: 689, width: 34, height: 34, pivotx: 16, pivoty: 4},
                  normal: {x: 374, y: 655, width: 34, height: 34, pivotx: 16, pivoty: 4}
                },
                frame: 'normal',
                className: 'StatusIcon'
              }
            },
            karmaUp: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 374, y: 689, width: 34, height: 34, pivotx: -102, pivoty: 4},
                },
                frame: 'normal',
                className: 'StatusIcon'
              }
            },
            karmaDown: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 374, y: 655, width: 34, height: 34, pivotx: 10, pivoty: 4}
                },
                frame: 'normal',
                className: 'StatusIcon'
              }
            },
            karmaUpInactive: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 0, y: 702, width: 34, height: 34, pivotx: -102, pivoty: 4},
                },
                frame: 'normal',
                className: 'StatusIcon inactive'
              }
            },
            karmaDownInactive: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 0, y: 668, width: 34, height: 34, pivotx: 10, pivoty: 4}
                },
                frame: 'normal',
                className: 'StatusIcon inactive'
              }
            },

            XP: {
              icon: {
                frameSrc: 'MainSprites.png',
                frameMap: {
                  normal: {x: 325, y: 655, width: 47, height: 46, pivotx: -92, pivoty: 10}
                },
                frame: 'normal',
                className: 'StatusIcon'
              }
            },
            background : {
              frameSrc: 'MainSprites.png',
              frameMap: {
                normal: {x: 36, y: 580, width: 131, height: 28, pivotx: 0, pivoty: 0}
              },
              frame: 'normal',
              className: 'StatusBackground'
            },
            background2 : {
              frameSrc: 'MainSprites.png',
              frameMap: {
                normal: {x: 2, y: 942, width: 130, height: 34, pivotx: 0, pivoty: 0}
              },
              frame: 'normal',
              className: 'StatusBackground'
            },
            background3 : {
              frameSrc: 'MainSprites.png',
              frameMap: {
                normal: {x: 132, y: 942, width: 107, height: 34, pivotx: 0, pivoty: 0}
              },
              frame: 'normal',
              className: 'StatusBackground'
            }
          }
        }
      },
      "Missions": {
        "type_data": {
          "background": "database-background.jpg",
          "width": 960,
          "height": 600,
          "x": 0,
          "y": 0
        }
      },
      "Mission": {
        "type_data": {
          "goals_texts": {
            "buy_perp": _._("goal Buy Perp %s"),
            "buy_powerup": _._("goal Buy %s in Project %s"),
            "collect_cash": _._("goal Collect $%s from %s"),
            "collect_profiles": _._("goal Collect %s Profiles from %s"),
            "integrate_profiles": _._("goal Integrate %s x %s"),
            "upgrade_token": _._("goal Upgrade %s")
          },
          "popup_sprite": {
              "frameSrc": 'MainSprites.png',
              "frameMap": {
                "normal": { x: 698, y: 764, width: 140, height: 160, pivotx: 155,pivoty: 90 }
              },
              "frame": 'normal'
          }
        }
      },
      "Topscore": {
        "type_data": {
          "type_headlines": {
            "cash": _._('topscore cash headline'),
            "profiles": _._('topscore profiles headline'),
            "xp": _._('topscore xp headline'),
            "spent": _._('topscore spent headline')
          },
          "type_texts_notinranking": {
            "cash": _._('topscore cash text %s'),
            "profiles": _._('topscore profiles text %s'),
            "xp": _._('topscore xp text %s'),
            "spent": _._('topscore spent text %s')
          },
          "type_texts": {
            "cash": _._('topscore cash inranking'),
            "profiles": _._('topscore profiles inranking'),
            "xp": _._('topscore xp text inranking'),
            "spent": _._('topscore spent text inranking')
          }
        }
      },
      "Topscores": {
        "type_data": {
          "RenderTemplate" : "topscores.html",
          "type_titles": {
            "cash": _._('topscore Cash'),
            "profiles": _._('topscore Profiles'),
            "xp": _._('topscore XP'),
            "spent": _._('topscore Investor')
          }
        }
      },

      "Karmalauter": {
        "type_data": {
          "buy_button_text": _._('karma_buy Do it!')
        }
      },
      "DatabasePerp": {
        "type_data": {
          "label": _._('Database'),
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 184,
                "pivotx": 70,
                "pivoty": 87,
                "width": 145,
                "x": 516,
                "y": 314
              },
              "drag": {
                "height": 193,
                "pivotx": 72,
                "pivoty": 94,
                "width": 146,
                "x": 561,
                "y": 250
              },
              "hover": {
                "height": 195,
                "pivotx": 76,
                "pivoty": 94,
                "width": 156,
                "x": 707,
                "y": 250
              },
              "normal": {
                "height": 184,
                "pivotx": 70,
                "pivoty": 87,
                "width": 145,
                "x": 416,
                "y": 250
              }
            },
            "frameSrc": "MainSprites.png"
          },

          "perp_background_old": {
            "frameMap": {
              "active": {
                "height": 184,
                "pivotx": 70,
                "pivoty": 87,
                "width": 145,
                "x": 206,
                "y": 309
              },
              "drag": {
                "height": 193,
                "pivotx": 72,
                "pivoty": 94,
                "width": 146,
                "x": 652,
                "y": 309
              },
              "hover": {
                "height": 195,
                "pivotx": 78,
                "pivoty": 95,
                "width": 156,
                "x": 496,
                "y": 301
              },
              "normal": {
                "height": 184,
                "pivotx": 70,
                "pivoty": 87,
                "width": 145,
                "x": 351,
                "y": 309
              }
            },
            "frameSrc": "sprites_100x100.png"
          }
        }
      },
      "Database": {
        "type_data": {
          "background": "database-background.jpg",
          "width": 2048,
          "height": 1600,
          "x": -544,
          "y": -500,
          "zoom_scale": 1
        }
      },
      "UpgradePowerup": {
        "type_data": {
          "mgoal_text": _._("goal_upgrade %s in project %s"),
          "ntitle": _._("New Upgrade!"),
          "ntext": _._('ntext_upgrade Upgrade is now available in projects: %s'),
          "slot_background": {
            "frameMap": {
              "free": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 516,
                "y": 0
              },
              "locked": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 716,
                "y": 0
              },
              "hover": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 616,
                "y": 0
              },
              "normal": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 416,
                "y": 0
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },
      "AdPowerup": {
        "type_data": {
          "mgoal_text": _._("goal_ad %s in project %s"),
          "ntitle": _._("New Ad!"),
          "ntext": _._('ntext_ad Ad is now available in projects: %s'),
          "ntext_server": _._('ntext_server Ad is now available in projects: %s'),
          "slot_background": {
            "frameMap": {
              "free": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 516,
                "y": 0
              },
              "locked": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 616,
                "y": 0
              },
              "normal": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 416,
                "y": 0
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },
      "TeamMemberPowerup": {
        "type_data": {
          "mgoal_text": _._("goal_teammember %s in project %s"),
          "ntitle": _._("New Teammember!"),
          "ntext": _._('ntext_teammember teammember is now available in projects: %s'),
          "slot_background": {
            "frameMap": {
              "free": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 516,
                "y": 0
              },
              "locked": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 616,
                "y": 0
              },
              "normal": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 416,
                "y": 0
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },

      "Imperium": {
        "type_data": {
          "background": "imperium-background.jpg",
          "width": 2048,
          "height": 1600,
          "x": -544,
          "y": -500,
          "zoom_scale": 1
        }
      },
      "AgentPerp": {
        "type_data": {
          "mgoal_text": _._("goal_agent %s"),
          "ntitle": _._("New Agent!"),
          "ntext": _._('ntext_agent click on %s'),
          "buy_button_text": _._('agent buy_button'),
          "provided_perps_text": _._('contact_buy Knows %s contacts'),
          "provided_perps_button_text": _._('pusher buy_contact_button'),
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 104,
                "pivotx": 50,
                "pivoty": 50,
                "width": 104,
                "x": 208,
                "y": 0
              },
              "drag": {
                "height": 104,
                "pivotx": 47,
                "pivoty": 50,
                "width": 104,
                "x": 312,
                "y": 0
              },
              "hover": {
                "height": 104,
                "pivotx": 50,
                "pivoty": 50,
                "width": 104,
                "x": 104,
                "y": 0
              },
              "normal": {
                "height": 100,
                "pivotx": 47,
                "pivoty": 47,
                "width": 100,
                "x": 2,
                "y": 2
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },
      "ContactPerp": {
        "type_data": {
          "mgoal_text": _._("goal_contact %s"),
          "mgoal_text_charge_perp": _._("goal_contact Charge %s"),
          "ntitle": _._("New Contact!"),
          "ntext": _._('ntext_contact click on %s'),
          "button_text": _._("contact Make a Deal"),
          "buy_button_text": _._('contact buy_button'),
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 40,
                "width": 82,
                "x": 164,
                "y": 416
              },
              "drag": {
                "height": 82,
                "pivotx": 38,
                "pivoty": 41,
                "width": 82,
                "x": 246,
                "y": 416
              },
              "hover": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 40,
                "width": 82,
                "x": 82,
                "y": 416
              },
              "normal": {
                "height": 80,
                "pivotx": 38,
                "pivoty": 38,
                "width": 80,
                "x": 1,
                "y": 417
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },
      "PusherPerp": {
        "type_data": {
          "mgoal_text": _._("goal_pusher %s"),
          "ntitle": _._("New Pusher!"),
          "ntext": _._('ntext_pusher click on %s'),
          "provided_perps_text": _._('pusher_buy Knows %s clients'),
          "buy_button_text": _._('pusher buy_button'),
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 40,
                "width": 82,
                "x": 164,
                "y": 860
              },
              "drag": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 41,
                "width": 82,
                "x": 246,
                "y": 860
              },
              "hover": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 40,
                "width": 82,
                "x": 82,
                "y": 860
              },
              "normal": {
                "height": 80,
                "pivotx": 37,
                "pivoty": 37,
                "width": 80,
                "x": 1,
                "y": 861
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },
      "ClientPerp": {
        "type_data": {
          "mgoal_text": _._("goal_client %s"),
          "mgoal_text_charge_perp": _._("goal_client Charge %s"),
          "ntitle": _._("New Client!"),
          "ntext": _._('ntext_client click on %s'),
          "button_text": _._("client Make a Deal"),
          "buy_button_text": _._('client buy_button'),
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 104,
                "pivotx": 50,
                "pivoty": 50,
                "width": 104,
                "x": 208,
                "y": 208
              },
              "drag": {
                "height": 104,
                "pivotx": 47,
                "pivoty": 50,
                "width": 104,
                "x": 312,
                "y": 208
              },
              "hover": {
                "height": 104,
                "pivotx": 50,
                "pivoty": 50,
                "width": 104,
                "x": 104,
                "y": 208
              },
              "normal": {
                "height": 100,
                "pivotx": 47,
                "pivoty": 47,
                "width": 100,
                "x": 2,
                "y": 210
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },
      "ProxyPerp": {
        "type_data": {
          "mgoal_text": _._("goal_proxy"),
          "ntitle": _._("New Proxy!"),
          "ntext": _._('ntext_proxy click on %s'),
          "buy_button_text": _._('proxy buy_button'),
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 40,
                "width": 82,
                "x": 164,
                "y": 736
              },
              "drag": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 41,
                "width": 82,
                "x": 246,
                "y": 736
              },
              "hover": {
                "height": 83,
                "pivotx": 40,
                "pivoty": 40,
                "width": 82,
                "x": 82,
                "y": 736
              },
              "normal": {
                "height": 80,
                "pivotx": 38,
                "pivoty": 37,
                "width": 80,
                "x": 1,
                "y": 739
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },
      "CityPerp": {
        "type_data": {
          "mgoal_text": _._("goal_city %s"),
          "ntitle": _._("New City!"),
          "ntext": _._('ntext_city click on'),
          "buy_button_text": _._('city buy_button'),
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 150,
                "pivotx": 60,
                "pivoty": 120,
                "width": 120,
                "x": 416,
                "y": 100
              },
              "drag": {
                "height": 150,
                "pivotx": 60,
                "pivoty": 120,
                "width": 120,
                "x": 656,
                "y": 100
              },
              "hover": {
                "height": 150,
                "pivotx": 60,
                "pivoty": 120,
                "width": 120,
                "x": 536,
                "y": 100
              },
              "normal": {
                "height": 150,
                "pivotx": 60,
                "pivoty": 120,
                "width": 120,
                "x": 416,
                "y": 100
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      },
      "TokenPerp": {
        "type_data": {
          "mgoal_text": _._("goal_token %s"),
          "mgoal_text_charge_perp": _._("goal_token Charge %s"),
          "mgoal_text_collect_perp": _._("goal_token Integrate %s"),
          "ntitle": _._("New Token!"),
          "ntext": _._('ntext_token click on upgrade in the database to get %s'),
          "buy_button_text": _._('token buy_button'),
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 40,
                "width": 82,
                "x": 164,
                "y": 498
              },
              "drag": {
                "height": 82,
                "pivotx": 38,
                "pivoty": 41,
                "width": 82,
                "x": 164,
                "y": 498
              },
              "hover": {
                "height": 82,
                "pivotx": 40,
                "pivoty": 40,
                "width": 82,
                "x": 82,
                "y": 498
              },
              "normal": {
                "height": 80,
                "pivotx": 38,
                "pivoty": 38,
                "width": 80,
                "x": 1,
                "y": 499
              },
              "consumed": {
                "height": 80,
                "pivotx": 38,
                "pivoty": 38,
                "width": 80,
                "x": 247,
                "y": 499
              }

            },
            "frameSrc": "MainSprites.png"
          },
          "perp_background2": {
            "frameMap": {
              "normal": {
                "height": 100,
                "width": 100,
                "pivotx": 49,
                "pivoty": 49,
                "x": 2,
                "y": 314
              },
              "hover": {
                "height": 104,
                "width": 104,
                "pivotx": 52,
                "pivoty": 52,
                "x": 104,
                "y": 312
              },
              "drag": {
                "height": 104,
                "width": 104,
                "pivotx": 50,
                "pivoty": 52,
                "x": 208,
                "y": 312
              },
              "consumed": {
                "height": 104,
                "width": 104,
                "pivotx": 52,
                "pivoty": 52,
                "x": 312,
                "y": 312
              }
            },
            "frameSrc": "MainSprites.png"
          }

        }
      },
      "ProjectPerp": {
        "type_data": {
          "mgoal_text": _._("goal_project %s"),
          "mgoal_text_charge_perp": _._("goal_project Charge %s"),
          "ntitle": _._("New Project!"),
          "ntext": _._('ntext_project click on %s'),
          "button_text": _._("project Invest"),
          "buy_button_text": _._('project buy_button'),
          "upgrade_tab_text":_._('upgrade_tab text'),
          "ad_tab_text":_._('ad_tab text'),
          "server_tab_text":_._('server_tab text'),
          "teammember_tab_text":_._('teammember_tab text'),
          "powerup_slot_texts": {
            "upgrade": {
              "button_text": _._('upgrade buy_button'),
              "empty_slot_label": _._('upgrade empty_slot'),
              "add_slots_label": _._('upgrade add_slots label'),
              "title": _._('upgrade_slotbuy title'),
              "subtitle":  _._('upgrade_slotbuy subtitle'),
              "description": _._('upgrade_slotbuy description'),
              "slot_button_text":_._('upgrade_slotbuy buttontext')
            },
            "ad": {
              "button_text": _._('ad buy_button'),
              "empty_slot_label": _._('ad empty_slot'),
              "add_slots_label": _._('ad add_slots label'),
              "title": _._('ad_slotbuy title'),
              "subtitle":  _._('ad_slotbuy subtitle'),
              "description": _._('ad_slotbuy description'),
              "slot_button_text":_._('ad_slotbuy buttontext')
            },
            "server": {
              "button_text": _._('server buy_button'),
              "empty_slot_label": _._('server empty_slot'),
              "add_slots_label": _._('server add_slots label'),
              "title": _._('server_slotbuy title'),
              "subtitle":  _._('server_slotbuy subtitle'),
              "description": _._('server_slotbuy description'),
              "slot_button_text":_._('server_slotbuy buttontext')
            },
            "teammember": {
              "button_text": _._('teammember buy_button'),
              "empty_slot_label": _._('teammember empty_slot'),
              "add_slots_label": _._('teammember add_slots label'),
              "title": _._('teammember_slotbuy title'),
              "subtitle":  _._('teammember_slotbuy subtitle'),
              "description": _._('teammember_slotbuy description'),
              "slot_button_text":_._('teammember_slotbuy buttontext')
            }
          },
          "perp_background": {
            "frameMap": {
              "active": {
                "height": 104,
                "pivotx": 50,
                "pivoty": 50,
                "width": 104,
                "x": 208,
                "y": 104
              },
              "drag": {
                "height": 104,
                "pivotx": 47,
                "pivoty": 50,
                "width": 104,
                "x": 312,
                "y": 104
              },
              "hover": {
                "height": 104,
                "pivotx": 50,
                "pivoty": 50,
                "width": 104,
                "x": 104,
                "y": 104
              },
              "normal": {
                "height": 100,
                "pivotx": 47,
                "pivoty": 47,
                "width": 100,
                "x": 2,
                "y": 106
              }
            },
            "frameSrc": "MainSprites.png"
          },
          "slot_background": {
            "frameMap": {
              "free": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 516,
                "y": 0
              },
              "locked": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 716,
                "y": 0
              },
              "hover": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 616,
                "y": 0
              },
              "normal": {
                "height": 100,
                "pivotx": 0,
                "pivoty": 0,
                "width": 100,
                "x": 416,
                "y": 0
              }
            },
            "frameSrc": "MainSprites.png"
          }
        }
      }
    };

    return type_settings;
  };
  
  return {
    getTypeSettings: function() {
      return typeSettings();
    }
  };
});
