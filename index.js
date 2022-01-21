const { Plugin } = require('powercord/entities')
const { findInReactTree } = require('powercord/util')
const { getModule, getModuleByDisplayName, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')

const { Messages } = getModule(m => m.Messages && m.Messages['en-US'], false) || {}
const ChatCheck = getModuleByDisplayName('ChatCheck', false)

module.exports = class QuickMarkAsRead extends Plugin {
    buttons = []

    async startPlugin() {
        const _this = this
        const classes = {
            ...await getModule(['addButton', 'clickable', 'wrapper']),
            ...await getModule(['iconItem'])
        }
        const { ack, ackCategory } = await getModule(['ack', 'ackCategory'])
        const { getChannel } = await getModule(['getChannel', 'getDMFromUserId'])
        const { getCategories } = await getModule(m => m.getCategories && !m.getByName && !m.getApplication)
        const { hasUnread } = await getModule(['hasCategoryUnread', 'hasUnread'])
        const MutesStore = await getModule(['isChannelMuted'])
        const Tooltip = await getModuleByDisplayName('Tooltip')

        const hasCategoryUnread = id => {
            const categoryChannel = getChannel(id)
            const categories = getCategories(categoryChannel?.guild_id)
            if (!categories?.[id]) return false
            return categories[id]
                .some(({ channel }) => hasUnread(channel.id) && !MutesStore.isChannelMuted(channel.guild_id, channel.id))
        }

        const ChannelItem = await getModule(m => m.default && m.default.displayName === 'ChannelItem')
        inject('qmar', ChannelItem, 'default', args => {
            this.buttons.filter(b => b.props.channelId === args[0]?.channel?.parent_id).forEach(b => b.forceUpdate())
            if (!args[0]?.unread || args[0].children.find(c => c?.props?.__qmar)) return args
            args[0].children.unshift(React.createElement(
                'div', { className: classes.iconItem, __qmar: true }, React.createElement(
                    Tooltip, { text: Messages.MARK_AS_READ }, props => React.createElement(ChatCheck, {
                        ...props,
                        className: classes.actionIcon,
                        width: 16,
                        height: 16,
                        onClick: () => ack(args[0].channel.id)
                    })
                )
            ))
            return args
        }, true)
        ChannelItem.default.displayName = 'ChannelItem'

        class QMARCategoryButton extends React.PureComponent {
            constructor(props) {
                super(props)

                _this.buttons.push(this)
            }

            componentWillUnmount() {
                const i = _this.buttons.indexOf(this)
                if (i != -1) _this.buttons.splice(i, 1)
            }

            render() {
                if (hasCategoryUnread(this.props.channelId)) return React.createElement(
                    Tooltip,
                    { text: Messages.MARK_AS_READ },
                    props => React.createElement(ChatCheck, {
                        ...props,
                        className: classes.actionIcon,
                        style: { zIndex: 1 },
                        width: 18,
                        onClick: () => ackCategory(this.props.channelId)
                    })
                )
                return null
            }
        }

        const { iconVisibility } = await getModule(['addButton', 'iconVisibility'])
        const { DecoratedComponent: Category } = await getModule(m =>
            m.DecoratedComponent && m.DecoratedComponent.type &&
            (m.DecoratedComponent.__powercordOriginal_type || m.DecoratedComponent.type).toString().indexOf('Messages.CATEGORY_A11Y_LABEL') !== -1
        )
        inject('qmar-category', Category, 'type', (args, res) => {
            const content = findInReactTree(res, e => e.onContextMenu)
            if (!content) return res
            const { props } = content.children[1]
            if (!Array.isArray(props.children)) props.children = [ props.children ]
            if (props.children.find(c => c?.type?.name === 'QMARCategoryButton')) return res
            props.children.unshift(React.createElement(QMARCategoryButton, {
                channelId: args[0].channel.id
            }))
            return res
        })
        Category.type.toString = () => Category.type.__powercordOriginal_type.toString()
    }

    pluginWillUnload() {
        uninject('qmar')
        uninject('qmar-category')
    }
}
